import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });

const SUB_ID = 'f804c412-09c4-4e39-a65a-7058b6723738';

(async () => {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await ds.initialize();

  // REN-004: subscripción recién vencida (1h atrás), sin gracia abierta,
  // limpiar last_renewal_attempt_at para saltar throttle 6h.
  await ds.query(
    `UPDATE subscriptions
     SET status = 'active',
         current_period_start = now() - interval '30 days' - interval '1 hour',
         current_period_end   = now() - interval '1 hour',
         grace_period_until   = NULL,
         last_renewal_attempt_at = NULL,
         last_renewal_init_point = NULL,
         updated_at = now()
     WHERE id = $1`,
    [SUB_ID],
  );

  const after = await ds.query(
    `SELECT id, status, current_period_end, grace_period_until,
            last_renewal_attempt_at, last_renewal_init_point, now() as db_now
     FROM subscriptions WHERE id = $1`,
    [SUB_ID],
  );
  console.log('SETUP REN-004:', JSON.stringify(after, null, 2));
  await ds.destroy();
})().catch((e) => { console.error(e); process.exit(1); });
