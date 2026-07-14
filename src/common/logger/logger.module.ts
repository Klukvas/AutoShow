import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';
import type { EnvSchema } from '../../config/env.validation';

@Module({
  imports: [
    PinoLoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvSchema, true>) => {
        const isDev = config.get('NODE_ENV', { infer: true }) === 'development';
        const correlationHeader = config.get('CORRELATION_ID_HEADER', { infer: true });
        return {
          pinoHttp: {
            level: config.get('LOG_LEVEL', { infer: true }),
            transport: isDev
              ? {
                  target: 'pino-pretty',
                  options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
                }
              : undefined,
            genReqId: (req, res) => {
              const incoming = (req.headers[correlationHeader] as string) || randomUUID();
              res.setHeader(correlationHeader, incoming);
              return incoming;
            },
            customProps: (req) => ({ correlationId: (req as { id?: string }).id }),
            serializers: {
              req(req) {
                return { id: req.id, method: req.method, url: req.url, host: req.headers?.host };
              },
              res(res) {
                return { statusCode: res.statusCode };
              },
            },
          },
        };
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
