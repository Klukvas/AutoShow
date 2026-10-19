import { OPENAI_TEXT_MAX_RESPONSE_BYTES, OpenAiTextProvider } from './openai-text.provider';
import { TextAiError, type TextAiRequest } from './text-ai.provider';

const KEY = 'sk-fixture-text-key-0123456789';
const request: TextAiRequest = {
  model: 'gpt-fixture',
  instructions: 'Rules',
  text: 'Data',
  images: [{ mime: 'image/jpeg', data: Buffer.from('jpeg-bytes') }],
  schemaName: 'listing_description',
  schema: { type: 'object' },
  maxOutputTokens: 4000,
  timeoutMs: 1000,
};

function provider(requireApiKey = jest.fn().mockResolvedValue(KEY)) {
  return new OpenAiTextProvider({ requireApiKey } as never);
}

const ok = (body: unknown, status = 200) =>
  jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

const message = (content: unknown[]) => ({
  status: 'completed',
  model: 'gpt-fixture-2026',
  output: [{ type: 'reasoning' }, { type: 'message', content }],
  usage: { input_tokens: 1200, output_tokens: 350 },
});

async function failure(promise: Promise<unknown>): Promise<TextAiError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(TextAiError);
  expect(JSON.stringify(error) + String((error as Error).message)).not.toContain(KEY);
  return error as TextAiError;
}

describe('OpenAiTextProvider', () => {
  afterEach(() => jest.restoreAllMocks());

  it('sends a strict schema, inline images and no storage, and parses the JSON answer', async () => {
    const fetch = ok(message([{ type: 'output_text', text: '{"description":"Текст"}' }]));
    const response = await provider().generate(request);
    expect(response).toMatchObject({
      output: { description: 'Текст' },
      model: 'gpt-fixture-2026',
      inputTokens: 1200,
      outputTokens: 350,
    });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init).toMatchObject({ method: 'POST', redirect: 'error' });
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    const body = JSON.parse(String(init?.body));
    expect(body).toMatchObject({
      model: 'gpt-fixture',
      store: false,
      max_output_tokens: 4000,
      text: { format: { type: 'json_schema', name: 'listing_description', strict: true } },
    });
    expect(body.input[0]).toEqual({ role: 'system', content: 'Rules' });
    expect(body.input[1].content).toEqual([
      { type: 'input_text', text: 'Data' },
      {
        type: 'input_image',
        image_url: `data:image/jpeg;base64,${Buffer.from('jpeg-bytes').toString('base64')}`,
        detail: 'low',
      },
    ]);
  });

  it('is unavailable without a key and never calls the network', async () => {
    const fetch = jest.spyOn(global, 'fetch');
    const error = await failure(
      provider(jest.fn().mockRejectedValue(new Error('no key'))).generate(request),
    );
    expect(error.kind).toBe('unavailable');
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([
    [429, 'rate_limited'],
    [500, 'provider_error'],
    [401, 'provider_error'],
  ])('maps HTTP %i to %s without echoing the body', async (status, kind) => {
    ok({ error: { message: `bad key ${KEY}` } }, status);
    const error = await failure(provider().generate(request));
    expect(error.kind).toBe(kind);
    expect(error.detail).toBe(`http ${status}`);
  });

  it('reports refusals, incomplete answers and non-JSON output', async () => {
    ok(message([{ type: 'refusal', refusal: 'no' }]));
    expect((await failure(provider().generate(request))).kind).toBe('refused');
    ok({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] });
    const incomplete = await failure(provider().generate(request));
    expect([incomplete.kind, incomplete.detail]).toEqual(['incomplete', 'max_output_tokens']);
    ok(message([{ type: 'output_text', text: 'not json' }]));
    expect((await failure(provider().generate(request))).kind).toBe('invalid_output');
    ok(message([]));
    expect((await failure(provider().generate(request))).kind).toBe('invalid_output');
  });

  it('turns a timeout into a retry-later error', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(Object.assign(new Error('timed out'), { name: 'TimeoutError' }));
    expect((await failure(provider().generate(request))).kind).toBe('timeout');
  });

  it('refuses an oversized response body', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('x'.repeat(OPENAI_TEXT_MAX_RESPONSE_BYTES + 1)));
    const error = await failure(provider().generate(request));
    expect([error.kind, error.detail]).toEqual(['invalid_output', 'response too large']);
  });

  it('rejects a body that is not a response object instead of crashing', async () => {
    for (const body of [
      null,
      [],
      { output: {} },
      { output: [{ type: 'message', content: 'x' }] },
    ]) {
      ok(body);
      expect((await failure(provider().generate(request))).kind).toBe('invalid_output');
    }
  });

  it('maps a failed response to its code only, never its message', async () => {
    ok({ status: 'failed', error: { code: 'server_error', message: `boom ${KEY}` }, output: [] });
    const error = await failure(provider().generate(request));
    expect([error.kind, error.detail]).toEqual(['provider_error', 'server_error']);
    ok({ status: 'failed', error: { code: 'has spaces <script>' } });
    expect((await failure(provider().generate(request))).detail).toBe('failed');
  });

  it('keeps the billed usage on an incomplete or refused answer', async () => {
    ok({
      status: 'incomplete',
      incomplete_details: { reason: 'max_output_tokens' },
      model: 'gpt-fixture-2026',
      usage: { input_tokens: 900, output_tokens: 8000 },
      output: [],
    });
    const error = await failure(provider().generate(request));
    expect(error.usage).toMatchObject({
      model: 'gpt-fixture-2026',
      inputTokens: 900,
      outputTokens: 8000,
    });
  });

  it('keeps the reason a key was unavailable as the cause', async () => {
    const cause = new Error('decrypt failed');
    const error = await failure(provider(jest.fn().mockRejectedValue(cause)).generate(request));
    expect(error.cause).toBe(cause);
  });

  it('times out while reading a stalled body', async () => {
    const stalled = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{'));
      },
      pull: () => new Promise(() => undefined),
    });
    jest.spyOn(global, 'fetch').mockImplementation(async (_url, init) => {
      const signal = init?.signal as AbortSignal;
      const body = new ReadableStream<Uint8Array>({
        async start(controller) {
          const reader = stalled.getReader();
          controller.enqueue((await reader.read()).value);
          signal.addEventListener('abort', () =>
            controller.error(Object.assign(new Error('aborted'), { name: 'TimeoutError' })),
          );
        },
      });
      return new Response(body, { status: 200 });
    });
    const error = await failure(provider().generate({ ...request, timeoutMs: 50 }));
    expect(error.kind).toBe('timeout');
  });

  it('treats missing or malformed usage as unknown, not zero', async () => {
    ok({ ...message([{ type: 'output_text', text: '{}' }]), usage: { input_tokens: -1 } });
    expect(await provider().generate(request)).toMatchObject({
      inputTokens: null,
      outputTokens: null,
    });
  });
});
