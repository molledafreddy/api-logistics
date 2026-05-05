import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.development' });

const SUB_ID = 'f804c412-09c4-4e39-a65a-7058b6723738';
const OUT = '/Users/freddymolleda/Desktop/proyectos/api-logistics/sub-check.log';

(async () => {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await ds.initialize();

  let [free] = await ds.query(
    "SELECT id, name, price FROM plans WHERE price = 0 OR code = 'free' LIMIT 1",
  );
  if (!free) {
    [free] = await ds.query(
      "INSERT INTO plans (id, name, code, price, interval, is_active, limits, created_at, updated_at) VALUES (gen_random_uuid(), 'Free', 'free', 0, 'month', true, '{\"maxStopsPerOptimization\": 25, \"maxReoptimizationsPerDay\": 3}'::jsonb, now(), now()) RETURNING id, name, price",
    );
  }

  await ds.query(
    "UPDATE subscriptions SET status = 'active', plan_id = $2, current_period_start = now() - interval '60 days', current_period_end = now() - interval '30 days', grace_period_until = NULL, last_renewal_attempt_at = NULL, last_renewal_init_point = NULL, updated_at = now() WHERE id = $1",
    [SUB_ID, free.id],
  );

  const after = await ds.query(
    "SELECT s.id, s.status, p.name as plan_name, p.price, s.current_period_start, s.current_period_end, s.grace_period_until, s.last_renewal_attempt_at, s.last_renewal_init_point, now() as db_now FROM subscriptions s JOIN plans p ON p.id = s.plan_id WHERE s.id = $1",
    [SUB_ID],
  );
  fs.writeFileSync(OUT, 'SETUP REN-007 OK:\n' + JSON.stringify({ free, after }, null, 2) + '\n');
  await ds.destroy();
})().catch((e) => { fs.writeFileSync(OUT, 'ERR: ' + String(e)); process.exit(1); });
