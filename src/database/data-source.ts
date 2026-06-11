import { DataSource } from 'typeorm';
import { User } from '../modules/auth/entities/user.entity';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';

// Load env vars for CLI usage (override: true to bypass dotenvx pre-injection)
import { join } from 'path';
const envPath = join(
  __dirname,
  '../../.env.' + (process.env.NODE_ENV || 'development'),
);
dotenv.config({ path: envPath, override: true });
const isProd = process.env.NODE_ENV === 'production';
export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'logistics_dev',
  username: process.env.DB_USER || 'logistics',
  password: process.env.DB_PASSWORD || 'logistics_dev_pass',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  logging: process.env.DB_LOGGING === 'true',
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  entities: isProd ? ['dist/**/*.entity.js'] : [User, 'src/**/*.entity.ts'],
  migrations: [
    isProd ? 'dist/database/migrations/*' : 'src/database/migrations/*.ts',
  ],
  // Cada migración corre en su propia transacción.
  // Necesario para soportar ALTER TYPE ADD VALUE seguido de un uso
  // del nuevo valor en una migración posterior (PostgreSQL exige commit).
  migrationsTransactionMode: 'each',
});
