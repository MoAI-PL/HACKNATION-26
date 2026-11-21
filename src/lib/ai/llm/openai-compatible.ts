// Dostawca zgodny z API OpenAI (POST {baseUrl}/chat/completions).
// Obsługuje: Ollama (http://localhost:11434/v1), Groq, Gemini (tryb zgodności z OpenAI) i inne.

import type { LLMConfig } from "./config";
import { LLMError, type ChatMessage, type ChatOptions, type ChatResult, type LLMProvider } from "./types";

interface CompletionResponse {
  model?: string;
  choices?: { message?: { content?: string | null } }[];
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  readonly model: string;

  constructor(
    private readonly config: LLMConfig,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {
    this.name = `openai-compatible:${config.baseUrl}`;
    this.model = config.model;
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<ChatResult> {
    const started = Date.now();
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), this.config.timeoutMs);
    const onOuterAbort = () => timeout.abort();
    options.signal?.addEventListener("abort", onOuterAbort);

    let res: Response;
    try {
      res = await this.fetchImpl(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(this.config.apiKey ? { Authorization: `Bearer ${this.config.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.config.model,
          messages,
          temperature: options.temperature ?? 0.1,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
          ...(options.json ? { response_format: { type: "json_object" } } : {}),
          stream: false,
        }),
        signal: timeout.signal,
      });
    } catch (e) {
      if (timeout.signal.aborted && !options.signal?.aborted) {
        throw new LLMError("PRZEKROCZONY_CZAS", `Model nie odpowiedział w ciągu ${Math.round(this.config.timeoutMs / 1000)} s.`);
      }
      if (options.signal?.aborted) throw new LLMError("BLAD_SIECI", "Zapytanie zostało anulowane.");
      throw new LLMError("BLAD_SIECI", `Nie udało się połączyć z modelem (${(e as Error).message}).`);
    } finally {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", onOuterAbort);
    }

    if (!res.ok) throw httpError(res.status);

    let data: CompletionResponse;
    try {
      data = (await res.json()) as CompletionResponse;
    } catch {
      throw new LLMError("NIEPOPRAWNA_ODPOWIEDZ", "Model zwrócił odpowiedź w nieoczekiwanym formacie.");
    }
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) {
      throw new LLMError("NIEPOPRAWNA_ODPOWIEDZ", "Model zwrócił pustą odpowiedź.");
    }
    return { content: content.trim(), model: data.model ?? this.config.model, durationMs: Date.now() - started };
  }
}

function httpError(status: number): LLMError {
  if (status === 401 || status === 403) {
    return new LLMError("BLAD_AUTORYZACJI", "Dostawca modelu odrzucił klucz API. Sprawdź LLM_API_KEY w pliku .env.", status);
  }
  if (status === 429) {
    return new LLMError("LIMIT_ZAPYTAN", "Przekroczono limit zapytań do modelu. Spróbuj ponownie za chwilę.", status);
  }
  if (status === 404) {
    return new LLMError("BLAD_DOSTAWCY", "Nie znaleziono modelu lub adresu API. Sprawdź LLM_BASE_URL i LLM_MODEL w pliku .env.", status);
  }
  return new LLMError("BLAD_DOSTAWCY", `Dostawca modelu zwrócił błąd (HTTP ${status}).`, status);
}
