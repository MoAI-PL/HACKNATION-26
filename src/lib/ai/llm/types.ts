// Warstwa modelu językowego (Z20). Format zgodny z API OpenAI (chat/completions),
// więc działa z Ollamą (lokalnie, np. Bielik / PLLuM) i z darmowymi API w chmurze – bez zmian w kodzie.

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatOptions {
  /** 0 = najbardziej przewidywalne odpowiedzi (domyślnie 0.1 – asystent formalny ma się trzymać źródeł). */
  temperature?: number;
  maxTokens?: number;
  /** Prośba o odpowiedź w formacie JSON (response_format: json_object), jeśli dostawca to obsługuje. */
  json?: boolean;
  /** Przerwanie żądania z zewnątrz (np. użytkownik anulował). */
  signal?: AbortSignal;
}

export interface ChatResult {
  content: string;
  /** Model, który faktycznie odpowiedział (do dziennika zapytań). */
  model: string;
  durationMs: number;
}

export interface LLMProvider {
  /** Nazwa do logów i dziennika zapytań, np. "openai-compatible:http://localhost:11434/v1". */
  readonly name: string;
  readonly model: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
}

/** Rodzaj błędu – interfejs pokazuje na jego podstawie spokojny komunikat i działa dalej bez AI. */
export type LLMErrorKind =
  | "BRAK_KONFIGURACJI"
  | "PRZEKROCZONY_CZAS"
  | "LIMIT_ZAPYTAN"
  | "BLAD_AUTORYZACJI"
  | "BLAD_DOSTAWCY"
  | "BLAD_SIECI"
  | "NIEPOPRAWNA_ODPOWIEDZ";

export class LLMError extends Error {
  constructor(
    readonly kind: LLMErrorKind,
    /** Komunikat po polsku – można pokazać użytkownikowi. */
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "LLMError";
  }
}
