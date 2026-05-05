import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.development' });

const SUB_ID = 'f804c412-09c4-4e39-a65a-7058b6723738';
const BUSINESS_PLAN_ID = 'c8713ff4-b5b8-41ba-b94e-95356272bcb6';
const OUT = '/Users/freddymolleda/Desktop/proyectos/api-logistics/sub-check.log';

(async () => {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await ds.initialize();

  // 1) Restaurar la sub a estado limpio: Business / active / period_end = now+30d.
  await ds.query(
    "UPDATE subscriptions SET status='active', plan_id=$2, current_period_start=now(), current_period_end=now() + interval '30 days', grace_period_until=NULL, last_renewal_attempt_at=NULL, last_renewal_init_point=NULL, canceled_at=NULL, updated_at=now() WHERE id=$1",
    [SUB_ID, BUSINESS_PLAN_ID],
  );

  // 2) Borrar plan Free temporal (creado para REN-007).
  const del = await ds.query(
    "DELETE FROM plans WHERE code='free' AND price=0 RETURNING id, name",
  );

  const after = await ds.query(
    "SELECT s.id, s.status, p.name AS plan_name, s.current_period_end, s.grace_period_until, s.last_renewal_attempt_at FROM subscriptions s JOIN plans p ON p.id=s.plan_id WHERE s.id=$1",
    [SUB_ID],
  );
  fs.writeFileSync(OUT, 'CLEANUP F.1 OK\nDeleted free plans: ' + JSON.stringify(del) + '\nSub state: ' + JSON.stringify(after, null, 2) + '\n');
  await ds.destroy();
})().catch((e) => { fs.writeFileSync(OUT, 'ERR: ' + String(e)); process.exit(1); });
