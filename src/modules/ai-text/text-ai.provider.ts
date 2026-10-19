/**
 * Provider-neutral contract for one structured text generation. Feature
 * modules build the request; adapters own transport, auth and parsing.
 */
export type TextAiImage = { mime: 'image/jpeg' | 'image/png' | 'image/webp'; data: Buffer };

export type TextAiRequest = {
  model: string;
  /** System-level instructions. */
  instructions: string;
  /** The user turn: data the instructions apply to. */
  text: string;
  images: readonly TextAiImage[];
  schemaName: string;
  /** Strict JSON schema the answer must match. */
  schema: Record<string, unknown>;
  maxOutputTokens: number;
  timeoutMs: number;
};

/** What a call cost, known even when the answer itself was unusable. */
export type TextAiUsage = {
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
};

export type TextAiResponse = TextAiUsage & {
  /** Parsed JSON; the caller still validates it against its own types. */
  output: unknown;
};

export type TextAiFailure =
  | 'unavailable'
  | 'timeout'
  | 'rate_limited'
  | 'provider_error'
  | 'refused'
  | 'incomplete'
  | 'invalid_output';

const MESSAGES: Record<TextAiFailure, string> = {
  unavailable: 'Генерація тексту ШІ поки недоступна.',
  timeout: 'ШІ не відповів вчасно. Спробуйте ще раз.',
  rate_limited: 'Постачальник ШІ тимчасово обмежив запити. Спробуйте пізніше.',
  provider_error: 'Постачальник ШІ повернув помилку. Спробуйте пізніше.',
  refused: 'ШІ відмовився створювати цей текст.',
  incomplete: 'ШІ не завершив відповідь. Спробуйте ще раз.',
  invalid_output: 'ШІ повернув некоректну відповідь. Спробуйте ще раз.',
};

/** Carries only a safe, user-facing message; details go to logs via `detail`. */
export class TextAiError extends Error {
  /** Set when the provider answered (and billed) but the answer was unusable. */
  readonly usage?: TextAiUsage;

  constructor(
    readonly kind: TextAiFailure,
    /** For logs only: status codes or reasons, never keys or prompt text. */
    readonly detail?: string,
    options: { cause?: unknown; usage?: TextAiUsage } = {},
  ) {
    super(MESSAGES[kind], { cause: options.cause });
    this.name = 'TextAiError';
    this.usage = options.usage;
  }

  withUsage(usage: TextAiUsage): TextAiError {
    return new TextAiError(this.kind, this.detail, { cause: this.cause, usage });
  }
}

export interface TextAiProvider {
  generate(request: TextAiRequest): Promise<TextAiResponse>;
}

export const TEXT_AI_PROVIDER = Symbol('TEXT_AI_PROVIDER');
