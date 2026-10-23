import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('per-install frontend media artifact', () => {
  it.each(['https://media.dealer-a.example', 'http://127.0.0.1:8081'])(
    'pins exactly %s for optimizer and presigned upload CSP',
    (origin) => {
      const result = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `const {default:c}=await import('./next.config.mjs');process.stdout.write(JSON.stringify({images:c.images,headers:await c.headers()}))`,
        ],
        {
          cwd: process.cwd(),
          env: { ...process.env, NODE_ENV: 'production', NEXT_PUBLIC_MEDIA_HOSTS: origin },
          encoding: 'utf8',
        },
      );
      const config = JSON.parse(result) as {
        images: { remotePatterns: { hostname: string; protocol: string; port?: string }[] };
        headers: { headers: { key: string; value: string }[] }[];
      };
      const url = new URL(origin);
      expect(config.images.remotePatterns).toContainEqual({
        protocol: url.protocol.slice(0, -1),
        hostname: url.hostname,
        ...(url.port ? { port: url.port } : {}),
      });
      expect(config.images.remotePatterns.some((entry) => entry.hostname.includes('*'))).toBe(
        false,
      );
      const csp = config.headers[0].headers.find(
        (header) => header.key === 'Content-Security-Policy',
      )?.value;
      expect(csp).toContain(`connect-src 'self' ${origin}`);
      expect(csp).not.toMatch(/https:\s|\*\./);
      expect(csp).not.toContain(
        origin.includes('dealer-a') ? '127.0.0.1:8081' : 'media.dealer-a.example',
      );
    },
  );
});
