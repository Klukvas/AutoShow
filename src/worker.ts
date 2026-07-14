import { NestFactory } from '@nestjs/core';
import { Logger as PinoLogger } from 'nestjs-pino';
import { WorkerAppModule } from './worker.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerAppModule, { bufferLogs: true });
  app.useLogger(app.get(PinoLogger));
  app.enableShutdownHooks();
  app.get(PinoLogger).log('AutoFlow worker started');
}

bootstrap().catch((err) => {
  console.error('Fatal worker bootstrap error', err);
  process.exit(1);
});
