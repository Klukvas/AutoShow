import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import sharp from 'sharp';
import { PhotoAiProvider } from './photo-ai.provider';
import { PhotoAi1792000000000 } from '../../database/migrations/1792000000000-PhotoAi';

describe('PhotoAiProvider safety', () => {
  afterEach(() => jest.restoreAllMocks());
  const provider = () =>
    new PhotoAiProvider(
      {
        PHOTO_AI_MODEL: 'test-model',
        PHOTO_AI_TIMEOUT_SECONDS: 10,
      } as never,
      {
        metadata: jest.fn().mockResolvedValue({ available: true }),
        requireCredential: jest.fn().mockResolvedValue('fixture-only-credential'),
      } as never,
      { requireAllowed: jest.fn().mockResolvedValue(undefined) } as never,
    );
  it('is disabled without configured key and does not call network', async () => {
    const network = jest.spyOn(global, 'fetch');
    const disabled = new PhotoAiProvider(
      {} as never,
      {
        metadata: jest.fn().mockResolvedValue({ available: false }),
        requireCredential: jest
          .fn()
          .mockRejectedValue(new ServiceUnavailableException('Unavailable')),
      } as never,
      { requireAllowed: jest.fn().mockResolvedValue(undefined) } as never,
    );
    await expect(disabled.edit(Buffer.from('image'), 'prompt', 'actor')).rejects.toMatchObject({
      status: 503,
    });
    expect(network).not.toHaveBeenCalled();
  });
  it('uses only fixed multipart edits endpoint and validates/normalizes base64 pixels', async () => {
    const bytes = await sharp({
      create: { width: 20, height: 10, channels: 3, background: '#555' },
    })
      .png()
      .toBuffer();
    const network = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ b64_json: bytes.toString('base64') }] })),
      );
    const output = await provider().edit(bytes, 'protected prompt', 'actor');
    expect((await sharp(output).metadata()).width).toBe(20);
    expect(network).toHaveBeenCalledWith(
      'https://api.openai.com/v1/images/edits',
      expect.objectContaining({ method: 'POST', redirect: 'error' }),
    );
    const form = network.mock.calls[0][1]?.body as FormData;
    expect(form.get('prompt')).toBe('protected prompt');
    expect(form.get('image[]')).toBeInstanceOf(Blob);
  });
  it('rejects arbitrary provider URL responses and hides provider errors', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ data: [{ url: 'https://internal.invalid' }] })),
      );
    await expect(provider().edit(Buffer.alloc(10), 'prompt', 'actor')).rejects.toThrow(
      'Некоректний результат',
    );
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(new Response('secret-provider-error', { status: 400 }));
    await expect(provider().edit(Buffer.alloc(10), 'prompt', 'actor')).rejects.not.toThrow(
      'secret-provider-error',
    );
  });
  it('rejects valid base64 that is not an image', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ data: [{ b64_json: Buffer.from('not image').toString('base64') }] }),
        ),
      );
    await expect(provider().edit(Buffer.alloc(10), 'prompt', 'actor')).rejects.toThrow();
  });
});
describe('PhotoAI additive migration role grant', () => {
  it('quotes configured role and rejects injection before executing SQL', async () => {
    const before = process.env.DB_APP_USER;
    const query = jest.fn();
    try {
      process.env.DB_APP_USER = 'photo_ai_custom';
      await new PhotoAi1792000000000().up({ query } as never);
      expect(query).toHaveBeenCalledWith(expect.stringContaining('TO "photo_ai_custom"'));
      query.mockClear();
      process.env.DB_APP_USER = 'role;DROP TABLE listings';
      await expect(new PhotoAi1792000000000().up({ query } as never)).rejects.toThrow(
        'Invalid DB_APP_USER',
      );
      expect(query).not.toHaveBeenCalled();
    } finally {
      if (before === undefined) delete process.env.DB_APP_USER;
      else process.env.DB_APP_USER = before;
    }
  });
});

describe('Provider final access fence', () => {
  it('does not fetch when access is revoked while awaiting the credential lookup', async () => {
    let resolveCredential: (key: string) => void = () => undefined;
    const credential = new Promise<string>((resolve) => {
      resolveCredential = resolve;
    });
    let allowed = true;
    const access = {
      requireAllowed: jest.fn(async () => {
        if (!allowed) throw new ForbiddenException();
      }),
    };
    const credentials = { requireCredential: jest.fn(() => credential) };
    const provider = new PhotoAiProvider(
      { PHOTO_AI_MODEL: 'fixture', PHOTO_AI_TIMEOUT_SECONDS: 10 } as never,
      credentials as never,
      access as never,
    );
    const network = jest.spyOn(global, 'fetch');
    try {
      const pending = provider.edit(Buffer.from('fixture'), 'prompt', 'actor');
      await Promise.resolve();
      expect(credentials.requireCredential).toHaveBeenCalled();
      allowed = false;
      resolveCredential('fixture-owner-key-123456789');
      await expect(pending).rejects.toBeInstanceOf(ForbiddenException);
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
    }
  });
});
