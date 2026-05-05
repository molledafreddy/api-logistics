import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });

(async () => {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await ds.initialize();
  const subs = await ds.query(
    `SELECT id, company_id, status, plan_id, current_period_start, current_period_end,
            last_renewal_attempt_at, grace_period_until, last_renewal_init_point, created_at, updated_at
     FROM subscriptions
     WHERE company_id = '5dbb6bc9-0cd6-487a-b4ba-daeab0c2984f'
     ORDER BY created_at DESC`,
  );
  console.log('SUBS:', JSON.stringify(subs, null, 2));
  await ds.destroy();
})().catch((e) => { console.error(e); process.exit(1); });
