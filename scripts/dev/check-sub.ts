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
  const sub = await ds.query(
    `SELECT id, status, current_period_end, last_renewal_attempt_at, grace_period_until, last_renewal_init_point, now() as db_now
     FROM subscriptions WHERE id = $1`,
    ['f804c412-09c4-4e39-a65a-7058b6723738'],
  );
  const out = 'SUB: ' + JSON.stringify(sub, null, 2) + '\n';
  console.log(out);
  require('fs').writeFileSync('/Users/freddymolleda/Desktop/proyectos/api-logistics/sub-check.log', out);
  await ds.destroy();
})().catch((e) => { console.error(e); process.exit(1); });
