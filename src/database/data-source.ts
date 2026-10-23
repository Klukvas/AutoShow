import { config as loadDotenv } from 'dotenv';
import 'reflect-metadata';
import { DataSource, type DataSourceOptions } from 'typeorm';
import { ALL_ENTITIES } from './entities';

loadDotenv({ path: process.env.ENV_FILE ?? '.env' });

export const adminDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT ?? 5432),
  database: process.env.DB_NAME,
  username: process.env.DB_ADMIN_USER,
  password: process.env.DB_ADMIN_PASSWORD,
  entities: ALL_ENTITIES,
  // Single glob relative to this file: resolves to *.ts under ts-node and *.js
  // once compiled — never both, so InitialSchema isn't registered twice.
  // Only timestamped migration files: the folder also holds *.spec.ts tests,
  // whose top-level jest calls crash the CLI and seeds when loaded here.
  migrations: [__dirname + '/migrations/[0-9]*-*.{ts,js}'],
  migrationsTableName: 'typeorm_migrations',
  logging: process.env.DB_LOGGING === 'true',
  synchronize: false,
};

const dataSource = new DataSource(adminDataSourceOptions);
export default dataSource;
