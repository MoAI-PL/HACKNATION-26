import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { chatJson, extractJson, getLLM, LLMError, readLLMConfig } from "@/lib/ai/llm";
import { OpenAICompatibleProvider } from "@/lib/ai/llm/openai-compatible";
import type { LLMProvider } from "@/lib/ai/llm";

const config = { baseUrl: "http://llm.test/v1", model: "bielik-test", apiKey: "klucz-testowy", timeoutMs: 1000 };

function odpowiedz(content: string, status = 200): Response {
  return new Response(JSON.stringify({ model: "bielik-test", choices: [{ message: { content } }] }), { status });
}

describe("konfiguracja modelu z .env", () => {
  it("bez LLM_BASE_URL lub LLM_MODEL → brak modelu (tryb bez AI)", () => {
    expect(readLLMConfig({})).toBeNull();
    expect(readLLMConfig({ LLM_BASE_URL: "http://x/v1" })).toBeNull();
    expect(getLLM({ LLM_MODEL: "m" })).toBeNull();
  });

  it("czyta adres, model, klucz i limit czasu; usuwa końcowy ukośnik", () => {
    expect(readLLMConfig({ LLM_BASE_URL: "http://localhost:11434/v1/", LLM_MODEL: "bielik", LLM_TIMEOUT_MS: "5000" })).toEqual({
      baseUrl: "http://localhost:11434/v1",
      model: "bielik",
      apiKey: undefined,
      embedModel: undefined,
      timeoutMs: 5000,
    });
  });

  it("puste wartości z .env.example oznaczają brak ustawienia (domyślny limit czasu)", () => {
    const env = { LLM_BASE_URL: "", LLM_MODEL: "", LLM_API_KEY: "", LLM_EMBED_MODEL: "", LLM_TIMEOUT_MS: "" };
    expect(readLLMConfig(env)).toBeNull();
    expect(readLLMConfig({ ...env, LLM_BASE_URL: "http://x/v1", LLM_MODEL: "m" })?.timeoutMs).toBe(30_000);
  });

  it("zmiana modelu w .env daje nowego dostawcę bez zmian w kodzie", () => {
    const a = getLLM({ LLM_BASE_URL: "http://a/v1", LLM_MODEL: "bielik" })!;
    const b = getLLM({ LLM_BASE_URL: "http://a/v1", LLM_MODEL: "pllum" })!;
    expect(a.model).toBe("bielik");
    expect(b.model).toBe("pllum");
  });
});

describe("dostawca zgodny z API OpenAI", () => {
  it("wysyła poprawne żądanie i zwraca treść, model i czas", async () => {
    const fetchMock = vi.fn(async () => odpowiedz("  Odpowiedź  "));
    const llm = new OpenAICompatibleProvider(config, fetchMock as unknown as typeof fetch);
    const r = await llm.chat([{ role: "user", content: "Pytanie" }], { json: true });
    expect(r.content).toBe("Odpowiedź");
    expect(r.model).toBe("bielik-test");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://llm.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer klucz-testowy");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "bielik-test", temperature: 0.1, response_format: { type: "json_object" }, stream: false });
  });

  it.each([
    [401, "BLAD_AUTORYZACJI", /LLM_API_KEY/],
    [429, "LIMIT_ZAPYTAN", /limit/],
    [404, "BLAD_DOSTAWCY", /LLM_MODEL/],
    [500, "BLAD_DOSTAWCY", /HTTP 500/],
  ])("HTTP %i → %s z komunikatem po polsku", async (status, kind, msg) => {
    const llm = new OpenAICompatibleProvider(config, (async () => new Response("{}", { status })) as typeof fetch);
    const err = await llm.chat([{ role: "user", content: "x" }]).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.kind).toBe(kind);
    expect(err.message).toMatch(msg);
  });

  it("brak odpowiedzi w limicie czasu → PRZEKROCZONY_CZAS", async () => {
    const wolny = ((_: unknown, init: RequestInit) =>
      new Promise((_r, reject) => init.signal!.addEventListener("abort", () => reject(new Error("aborted"))))) as typeof fetch;
    const llm = new OpenAICompatibleProvider({ ...config, timeoutMs: 20 }, wolny);
    const err = await llm.chat([{ role: "user", content: "x" }]).catch((e) => e);
    expect(err.kind).toBe("PRZEKROCZONY_CZAS");
  });

  it("brak połączenia → BLAD_SIECI; pusta odpowiedź → NIEPOPRAWNA_ODPOWIEDZ", async () => {
    const offline = new OpenAICompatibleProvider(config, (async () => {
      throw new TypeError("fetch failed");
    }) as typeof fetch);
    expect((await offline.chat([]).catch((e) => e)).kind).toBe("BLAD_SIECI");
    const pusty = new OpenAICompatibleProvider(config, (async () => odpowiedz("")) as typeof fetch);
    expect((await pusty.chat([]).catch((e) => e)).kind).toBe("NIEPOPRAWNA_ODPOWIEDZ");
  });
});

describe("odpowiedzi JSON", () => {
  it("wyciąga JSON także z bloku ```json", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Oto wynik: {"a": [1,2]} koniec')).toEqual({ a: [1, 2] });
    expect(() => extractJson("brak")).toThrow();
  });

  const schema = z.object({ kryteria: z.array(z.string()).max(3) });

  function llmZOdpowiedziami(...tresci: string[]): LLMProvider & { calls: number } {
    let i = 0;
    return {
      name: "test",
      model: "test",
      calls: 0,
      async chat() {
        this.calls++;
        return { content: tresci[i++]!, model: "test", durationMs: 1 };
      },
    };
  }

  it("poprawny JSON za pierwszym razem", async () => {
    const llm = llmZOdpowiedziami('{"kryteria": ["NEGOCJOWANIE"]}');
    expect((await chatJson(llm, [], schema)).data).toEqual({ kryteria: ["NEGOCJOWANIE"] });
    expect(llm.calls).toBe(1);
  });

  it("jedna ponowna próba przy niezgodności ze schematem", async () => {
    const llm = llmZOdpowiedziami('{"kryteria": ["A","B","C","D"]}', '{"kryteria": ["A"]}');
    expect((await chatJson(llm, [], schema)).data).toEqual({ kryteria: ["A"] });
    expect(llm.calls).toBe(2);
  });

  it("dwie złe odpowiedzi → NIEPOPRAWNA_ODPOWIEDZ", async () => {
    const llm = llmZOdpowiedziami("nie wiem", "{zepsuty");
    const err = await chatJson(llm, [], schema).catch((e) => e);
    expect(err).toBeInstanceOf(LLMError);
    expect(err.kind).toBe("NIEPOPRAWNA_ODPOWIEDZ");
  });
});
