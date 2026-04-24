import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

// Carga las variables de entorno igual que en data-source.ts
dotenv.config({
  path: `.env.${process.env.NODE_ENV || 'development'}`,
  override: true,
});

import config from './data-source';

async function testConnection() {
  try {
    await config.initialize();
    console.log(
      '✅ Conexión exitosa a la base de datos:',
      config.options.database,
    );
    const result = await config.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    console.log('Tablas en la base de datos:');
    console.table(result);
    await config.destroy();
  } catch (error) {
    console.error('❌ Error de conexión:', error);
    process.exit(1);
  }
}

testConnection();
