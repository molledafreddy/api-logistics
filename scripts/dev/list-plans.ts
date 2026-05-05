import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.development' });

const OUT = '/Users/freddymolleda/Desktop/proyectos/api-logistics/sub-check.log';

(async () => {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await ds.initialize();
  const plans = await ds.query(`SELECT * FROM plans ORDER BY price NULLS FIRST`);
  fs.writeFileSync(OUT, JSON.stringify(plans, null, 2) + '\n');
  await ds.destroy();
})().catch((e) => { fs.writeFileSync(OUT, String(e)); process.exit(1); });
