/**
 * Sprint G — Setup manual para validar POST /v1/billing/me/retry.
 *
 * Deja la suscripción en `suspended` con `last_renewal_attempt_at` viejo
 * para que el throttle de 5 minutos no rechace y el frontend (o curl) pueda
 * generar un nuevo checkout vía retry.
 *
 * Salida: imprime el curl listo para copiar.
 *
 * Uso: pnpm ts-node scripts/dev/setup-retry.ts
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.development' });

const SUB_ID = 'f804c412-09c4-4e39-a65a-7058b6723738';
const BUSINESS_PLAN_ID = 'c8713ff4-b5b8-41ba-b94e-95356272bcb6';
const OUT =
  '/Users/freddymolleda/Desktop/proyectos/api-logistics/sub-check.log';

(async () => {
  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await ds.initialize();

  // Sub suspended (gracia ya expirada hace 1d, periodo vencido hace 10d)
  await ds.query(
    `UPDATE subscriptions
        SET status = 'suspended',
            plan_id = $2,
            current_period_start = now() - interval '40 days',
            current_period_end = now() - interval '10 days',
            grace_period_until = now() - interval '1 day',
            suspended_at = now() - interval '1 day',
            last_renewal_attempt_at = now() - interval '1 hour',
            last_renewal_init_point = NULL,
            updated_at = now()
      WHERE id = $1`,
    [SUB_ID, BUSINESS_PLAN_ID],
  );

  const after = await ds.query(
    `SELECT s.id, s.status, p.name as plan_name, s.current_period_end,
            s.grace_period_until, s.suspended_at, s.last_renewal_attempt_at,
            s.last_renewal_init_point, now() as db_now
       FROM subscriptions s
       JOIN plans p ON p.id = s.plan_id
      WHERE s.id = $1`,
    [SUB_ID],
  );

  const banner = `SETUP RETRY OK — sub en 'suspended' lista para POST /v1/billing/me/retry

Pasos:
  1) Login con curl POST /v1/auth/login y guardar JWT en $TOKEN
  2) curl -X POST -H "Authorization: Bearer $TOKEN" \\
        http://localhost:3000/v1/billing/me/retry

Resultado esperado: { ok, subscriptionId, status: 'suspended', initPoint: 'mock://...' }
`;
  fs.writeFileSync(
    OUT,
    `${banner}\nESTADO ACTUAL:\n${JSON.stringify(after, null, 2)}\n`,
  );
  console.log(banner);
  await ds.destroy();
})().catch((e) => {
  fs.writeFileSync(OUT, 'ERR: ' + String(e));
  process.exit(1);
});
