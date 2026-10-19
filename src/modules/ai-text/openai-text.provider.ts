import { Injectable } from '@nestjs/common';
import { AiCredentialsService } from '../ai-credentials/ai-credentials.service';
import {
  TextAiError,
  type TextAiProvider,
  type TextAiRequest,
  type TextAiResponse,
  type TextAiUsage,
} from './text-ai.provider';

const ENDPOINT = 'https://api.openai.com/v1/responses';
export const OPENAI_TEXT_MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

type OutputPart = { type?: unknown; text?: unknown; refusal?: unknown };
type ResponsesBody = {
  status?: unknown;
  model?: unknown;
  error?: { code?: unknown } | null;
  incomplete_details?: { reason?: unknown } | null;
  output?: unknown;
  usage?: { input_tokens?: unknown; output_tokens?: unknown };
};

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

/** OpenAI Responses API with a strict JSON schema; images go inline as data URLs. */
@Injectable()
export class OpenAiTextProvider implements TextAiProvider {
  constructor(private readonly credentials: AiCredentialsService) {}

  async generate(request: TextAiRequest): Promise<TextAiResponse> {
    const apiKey = await this.credentials.requireApiKey().catch((cause: unknown) => {
      throw new TextAiError('unavailable', 'no usable key', { cause });
    });
    const startedAt = Date.now();
    const body = await this.post(apiKey, request);
    const usage: TextAiUsage = {
      model: typeof body.model === 'string' ? body.model : request.model,
      inputTokens: count(body.usage?.input_tokens),
      outputTokens: count(body.usage?.output_tokens),
      latencyMs: Date.now() - startedAt,
    };
    try {
      return { ...usage, output: this.outputOf(body) };
    } catch (error) {
      // An incomplete or refused answer is still billed: keep its usage.
      throw error instanceof TextAiError ? error.withUsage(usage) : error;
    }
  }

  private payload(request: TextAiRequest) {
    return {
      model: request.model,
      input: [
        { role: 'system', content: request.instructions },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: request.text },
            ...request.images.map((image) => ({
              type: 'input_image',
              image_url: `data:${image.mime};base64,${image.data.toString('base64')}`,
              detail: 'low',
            })),
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: request.schemaName,
          schema: request.schema,
          strict: true,
        },
      },
      max_output_tokens: request.maxOutputTokens,
      // Drafts are history in our DB; nothing needs to live on the provider side.
      store: false,
    };
  }

  private async post(apiKey: string, request: TextAiRequest): Promise<ResponsesBody> {
    let response: Response;
    try {
      // Fixed endpoint, no supplied URLs, no redirects. A paid request is
      // never retried here; the caller decides.
      response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(this.payload(request)),
        redirect: 'error',
        signal: AbortSignal.timeout(request.timeoutMs),
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      throw name === 'TimeoutError' || name === 'AbortError'
        ? new TextAiError('timeout')
        : new TextAiError('provider_error', `network: ${name || 'unknown'}`);
    }
    const raw = await this.readCapped(response);
    if (response.status === 429) throw new TextAiError('rate_limited', 'http 429');
    if (!response.ok) throw new TextAiError('provider_error', `http ${response.status}`);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new TextAiError('invalid_output', 'response is not JSON');
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
      throw new TextAiError('invalid_output', 'response is not an object');
    return parsed as ResponsesBody;
  }

  private async readCapped(response: Response): Promise<string> {
    if (!response.body) return '';
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > OPENAI_TEXT_MAX_RESPONSE_BYTES)
          throw new TextAiError('invalid_output', 'response too large');
        chunks.push(value);
      }
    } catch (error) {
      if (error instanceof TextAiError) throw error;
      const name = error instanceof Error ? error.name : '';
      throw name === 'TimeoutError' || name === 'AbortError'
        ? new TextAiError('timeout')
        : new TextAiError('provider_error', 'body read failed');
    } finally {
      await reader.cancel().catch(() => undefined);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  private outputOf(body: ResponsesBody): unknown {
    if (body.status === 'failed') {
      const code = body.error?.code;
      // Only a short machine code reaches logs, never the provider's message.
      const detail =
        typeof code === 'string' && /^[a-z0-9_.-]{1,64}$/i.test(code) ? code : 'failed';
      throw new TextAiError('provider_error', detail);
    }
    if (body.status === 'incomplete') {
      const reason = body.incomplete_details?.reason;
      throw new TextAiError('incomplete', typeof reason === 'string' ? reason : undefined);
    }
    const items = Array.isArray(body.output) ? (body.output as unknown[]) : [];
    const parts = items.flatMap((item): OutputPart[] => {
      const message = item as { type?: unknown; content?: unknown };
      return message?.type === 'message' && Array.isArray(message.content)
        ? (message.content as OutputPart[]).filter(
            (part) => typeof part === 'object' && part !== null,
          )
        : [];
    });
    if (parts.some((part) => part.type === 'refusal')) throw new TextAiError('refused');
    const text = parts.find((part) => part.type === 'output_text')?.text;
    if (typeof text !== 'string') throw new TextAiError('invalid_output', 'no output_text');
    try {
      return JSON.parse(text);
    } catch {
      throw new TextAiError('invalid_output', 'output_text is not JSON');
    }
  }
}
