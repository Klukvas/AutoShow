import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'dotenv';
import { validateEnv } from './env.validation';

const exampleEnv = () =>
  parse(readFileSync(join(process.cwd(), '.env.example'), { encoding: 'utf8' }));

describe('validateEnv', () => {
  it('accepts the example env file', () => {
    const config = validateEnv(exampleEnv());
    expect(config.PUBLIC_SITE_URL).toBe('http://localhost:3001');
  });

  it('parses false boolean strings as false', () => {
    const config = validateEnv({
      ...exampleEnv(),
      S3_FORCE_PATH_STYLE: 'false',
    });

    expect(config.S3_FORCE_PATH_STYLE).toBe(false);
  });

  it('rejects invalid boolean strings', () => {
    expect(() => validateEnv({ ...exampleEnv(), S3_FORCE_PATH_STYLE: 'definitely' })).toThrow(
      'S3_FORCE_PATH_STYLE: must be true or false',
    );
  });

  it('rejects a missing required key', () => {
    const env = exampleEnv();
    delete env.DB_HOST;
    expect(() => validateEnv(env)).toThrow('DB_HOST');
  });
});
