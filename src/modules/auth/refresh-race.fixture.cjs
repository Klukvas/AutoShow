require('ts-node/register/transpile-only');
const Redis = require('ioredis');
const { JwtService } = require('@nestjs/jwt');
const { AuthTokenService } = require('./auth-token.service');
const redis = new Redis({
  host: '127.0.0.1',
  port: Number(process.env.AUDIT_TEST_REDIS_PORT),
  lazyConnect: false,
});
const config = {
  JWT_ACCESS_SECRET: 'fixture-access',
  JWT_REFRESH_SECRET: 'fixture-refresh',
  JWT_ACCESS_TTL: 900,
  JWT_REFRESH_TTL: 600,
};
process.on('message', async ({ token, proof }) => {
  try {
    const svc = new AuthTokenService(new JwtService(), { client: redis }, config);
    const pair = await svc.rotate(
      token,
      async (record) => ({
        id: record.userId,
        email: record.email,
        role: record.role,
        authVersion: record.authVersion,
      }),
      proof,
    );
    process.send({ pair }, () => redis.quit().then(() => process.exit(0)));
  } catch (error) {
    process.send({ error: error.message }, () => redis.quit().then(() => process.exit(1)));
  }
});
redis.once('ready', () => process.send({ ready: true }));
