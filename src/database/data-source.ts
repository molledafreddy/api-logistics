import { DataSource } from 'typeorm';
import { User } from '../modules/auth/entities/user.entity';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load env file for CLI usage only when vars not already in process.env
if (!process.env.DATABASE_URL && !process.env.DB_HOST) {
  const envPath = join(
    __dirname,
    '../../.env.' + (process.env.NODE_ENV || 'development'),
  );
  dotenv.config({ path: envPath });
}

const isProd = process.env.NODE_ENV === 'production';

const dataSourceOptions = process.env.DATABASE_URL
  ? {
      url: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'logistics_dev',
      username: process.env.DB_USER || 'logistics',
      password: process.env.DB_PASSWORD || 'logistics_dev_pass',
      ssl:
        process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    };

export default new DataSource({
  type: 'postgres',
  ...dataSourceOptions,
  logging: process.env.DB_LOGGING === 'true',
  synchronize: false,
  namingStrategy: new SnakeNamingStrategy(),
  entities: isProd ? ['dist/**/*.entity.js'] : [User, 'src/**/*.entity.ts'],
  migrations: [
    isProd ? 'dist/database/migrations/*' : 'src/database/migrations/*.ts',
  ],
  migrationsTransactionMode: 'each',
});
