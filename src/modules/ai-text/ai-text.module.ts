import { Module } from '@nestjs/common';
import { AiCredentialsModule } from '../ai-credentials/ai-credentials.module';
import { OpenAiTextProvider } from './openai-text.provider';
import { TEXT_AI_PROVIDER } from './text-ai.provider';

/** Structured text generation behind a provider-neutral token. */
@Module({
  imports: [AiCredentialsModule],
  providers: [{ provide: TEXT_AI_PROVIDER, useClass: OpenAiTextProvider }],
  exports: [TEXT_AI_PROVIDER],
})
export class AiTextModule {}
