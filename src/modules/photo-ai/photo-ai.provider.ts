import { PhotoAiAccessService } from './photo-ai-access.service';
import { PhotoAiCredentialsService } from './photo-ai-credentials.service';
import { Inject, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import type { AppConfig } from '../../config/config.module';

export const PHOTO_AI_MAX_OUTPUT_BYTES = 20 * 1024 * 1024;
export const PHOTO_AI_MAX_PIXELS = 40_000_000;

@Injectable()
export class PhotoAiProvider {
  constructor(
    @Inject('APP_CONFIG') private readonly config: AppConfig,
    private readonly credentials: PhotoAiCredentialsService,
    private readonly access: PhotoAiAccessService,
  ) {}

  async availability(): Promise<{ enabled: boolean; reason: string | null }> {
    const enabled = (await this.credentials.metadata()).available;
    return { enabled, reason: enabled ? null : 'Обробка ШІ поки недоступна.' };
  }

  async edit(image: Buffer, prompt: string, actorId: string): Promise<Buffer> {
    await this.access.requireAllowed(actorId);
    const apiKey = await this.credentials.requireCredential();
    const form = new FormData();
    form.append('model', this.config.PHOTO_AI_MODEL);
    form.append('prompt', prompt);
    form.append('n', '1');
    form.append('size', 'auto');
    form.append('quality', 'medium');
    form.append('output_format', 'png');
    form.append(
      'image[]',
      new Blob([new Uint8Array(image)], { type: 'image/png' }),
      'original.png',
    );
    // Fixed provider endpoint, no supplied URLs and no redirects. A timed-out
    // paid request is never retried automatically by this adapter or the worker.
    await this.access.requireAllowed(actorId);
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      redirect: 'error',
      signal: AbortSignal.timeout(this.config.PHOTO_AI_TIMEOUT_SECONDS * 1000),
    });
    if (!response.ok || !response.body)
      throw new Error('Не вдалося створити фото. Спробуйте новий запит пізніше.');
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > PHOTO_AI_MAX_OUTPUT_BYTES * 1.4)
          throw new Error('Результат перевищує допустимий розмір.');
        chunks.push(value);
      }
    } finally {
      await reader.cancel();
    }
    const data: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    const encoded = (data as { data?: Array<{ b64_json?: unknown }> })?.data?.[0]?.b64_json;
    if (typeof encoded !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))
      throw new Error('Некоректний результат обробки.');
    const output = Buffer.from(encoded, 'base64');
    if (!output.length || output.length > PHOTO_AI_MAX_OUTPUT_BYTES)
      throw new Error('Результат перевищує допустимий розмір.');
    const metadata = await sharp(output, { limitInputPixels: PHOTO_AI_MAX_PIXELS }).metadata();
    if (
      !metadata.width ||
      !metadata.height ||
      !['png', 'jpeg', 'webp'].includes(metadata.format ?? '') ||
      (metadata.pages ?? 1) !== 1
    ) {
      throw new Error('Некоректний формат результату.');
    }
    // Normalize format and strip EXIF before storing or rendering provider data.
    const normalized = await sharp(output, { limitInputPixels: PHOTO_AI_MAX_PIXELS })
      .rotate()
      .png()
      .toBuffer();
    if (normalized.length > PHOTO_AI_MAX_OUTPUT_BYTES)
      throw new Error('Результат перевищує допустимий розмір.');
    return normalized;
  }
}
