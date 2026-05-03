import { Logger } from '@nestjs/common';
import dataSource from '../data-source';

const logger = new Logger('PlansV2Seed');

/**
 * Sprint A — Catálogo verticalizado de planes (additivo, NO destructivo).
 *
 * Inserta los 5 planes "del nuevo mundo" + 7 permisos nuevos + límites por
 * vertical, y materializa el jsonb `plans.limits`. Convive con los planes
 * legacy (Free/Basic/Business/Enterprise) sin romperlos.
 *
 * Este seed es idempotente: puede correrse múltiples veces sin duplicar.
 */
export async function seedPlansV2(): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  // ───────────────────────────────────────────────────────────────
  // 1) Definición declarativa
  // ───────────────────────────────────────────────────────────────
  type PlanSpec = {
    code: string;
    name: string;
    description: string;
    audience: 'courier' | 'passenger' | 'fleet' | 'any';
    tier: 'free' | 'pro' | 'enterprise';
    price: number;
    interval: string;
    limits: Array<{ vertical: string; code: string; value: number }>;
    permissions: string[];
  };

  const newPermissions = [
    {
      code: 'optimization.basic',
      description: 'Optimización de rutas básica (NN)',
    },
    {
      code: 'optimization.advanced',
      description: 'Optimización de rutas avanzada (NN + 2-opt)',
    },
    {
      code: 'optimization.vrp',
      description: 'Vehicle Routing Problem multi-vehículo',
    },
    {
      code: 'optimization.reoptimize',
      description: 'Reoptimización dinámica en tiempo real',
    },
    {
      code: 'routes.multi_driver',
      description: 'Asignación multi-conductor por ruta',
    },
    {
      code: 'passenger.recurring',
      description: 'Plantillas de viajes recurrentes (pasajeros)',
    },
    {
      code: 'tracking.public_link',
      description: 'Link público de tracking del envío',
    },
  ];

  const plans: PlanSpec[] = [
    {
      code: 'free_courier',
      name: 'Free Courier',
      description: 'Plan gratuito para couriers individuales.',
      audience: 'courier',
      tier: 'free',
      price: 0,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 15 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 10 },
      ],
      permissions: [
        'shipments.read',
        'shipments.write',
        'drivers.read',
        'optimization.basic',
      ],
    },
    {
      code: 'pro_courier',
      name: 'Pro Courier',
      description: 'Couriers con optimización avanzada y mayor volumen.',
      audience: 'courier',
      tier: 'pro',
      price: 9990,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 200 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 50 },
      ],
      permissions: [
        'shipments.read',
        'shipments.write',
        'drivers.read',
        'drivers.write',
        'trucks.read',
        'optimization.basic',
        'optimization.advanced',
        'optimization.reoptimize',
        'tracking.public_link',
      ],
    },
    {
      code: 'free_passenger',
      name: 'Free Passenger',
      description: 'Plan gratuito vertical pasajeros.',
      audience: 'passenger',
      tier: 'free',
      price: 0,
      interval: 'month',
      limits: [{ vertical: 'global', code: 'maxRidesPerDay', value: 10 }],
      permissions: ['shipments.read'],
    },
    {
      code: 'pro_passenger',
      name: 'Pro Passenger',
      description: 'Pasajeros con viajes recurrentes y optimización avanzada.',
      audience: 'passenger',
      tier: 'pro',
      price: 14990,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxRidesPerDay', value: 100 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 30 },
      ],
      permissions: [
        'shipments.read',
        'shipments.write',
        'optimization.basic',
        'optimization.advanced',
        'passenger.recurring',
        'tracking.public_link',
      ],
    },
    {
      code: 'enterprise_fleet',
      name: 'Enterprise Fleet',
      description:
        'Plan enterprise para flotas: VRP multi-vehículo, multi-conductor, sin límites prácticos.',
      audience: 'fleet',
      tier: 'enterprise',
      price: 99990,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 100000 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 500 },
        { vertical: 'trucking', code: 'max_trucks', value: 1000 },
      ],
      permissions: [
        'plans.read',
        'shipments.read',
        'shipments.write',
        'drivers.read',
        'drivers.write',
        'trucks.read',
        'trucks.write',
        'reports.advanced',
        'settings.billing',
        'optimization.basic',
        'optimization.advanced',
        'optimization.vrp',
        'optimization.reoptimize',
        'routes.multi_driver',
        'tracking.public_link',
      ],
    },
  ];

  // ───────────────────────────────────────────────────────────────
  // 2) Permisos nuevos (idempotente)
  // ───────────────────────────────────────────────────────────────
  for (const p of newPermissions) {
    const exists = await dataSource.query(
      `SELECT id FROM permission_definitions WHERE code = $1`,
      [p.code],
    );
    if (exists.length === 0) {
      await dataSource.query(
        `INSERT INTO permission_definitions (code, description, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())`,
        [p.code, p.description],
      );
      logger.log(`Permiso creado: ${p.code}`);
    }
  }

  // Mapa code → permId (todos los necesarios)
  const allPermCodes = Array.from(new Set(plans.flatMap((p) => p.permissions)));
  const permRows: Array<{ id: string; code: string }> = await dataSource.query(
    `SELECT id, code FROM permission_definitions WHERE code = ANY($1)`,
    [allPermCodes],
  );
  const permIdByCode: Record<string, string> = Object.fromEntries(
    permRows.map((r) => [r.code, r.id]),
  );

  // ───────────────────────────────────────────────────────────────
  // 3) Planes nuevos + plan_permissions + plan_limits + jsonb
  // ───────────────────────────────────────────────────────────────
  for (const plan of plans) {
    const row = await dataSource.query(`SELECT id FROM plans WHERE code = $1`, [
      plan.code,
    ]);
    let planId: string;

    if (row.length === 0) {
      const inserted = await dataSource.query(
        `INSERT INTO plans (
           code, name, description, audience, tier,
           price, interval, is_active, limits,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, '{}'::jsonb, NOW(), NOW())
         RETURNING id`,
        [
          plan.code,
          plan.name,
          plan.description,
          plan.audience,
          plan.tier,
          plan.price,
          plan.interval,
        ],
      );
      planId = inserted[0].id;
      logger.log(`Plan creado: ${plan.code}`);
    } else {
      planId = row[0].id;
      // Refrescar metadata por si cambió en código
      await dataSource.query(
        `UPDATE plans
            SET name = $2, description = $3, audience = $4, tier = $5,
                price = $6, interval = $7, is_active = true, updated_at = NOW()
          WHERE id = $1`,
        [
          planId,
          plan.name,
          plan.description,
          plan.audience,
          plan.tier,
          plan.price,
          plan.interval,
        ],
      );
    }

    // 3.a) plan_permissions (idempotente)
    for (const code of plan.permissions) {
      const permId = permIdByCode[code];
      if (!permId) {
        logger.warn(
          `⚠️  Permiso "${code}" no existe; se omite asignación a ${plan.code}`,
        );
        continue;
      }
      const existsPp = await dataSource.query(
        `SELECT id FROM plan_permissions WHERE plan_id = $1 AND permission_id = $2`,
        [planId, permId],
      );
      if (existsPp.length === 0) {
        await dataSource.query(
          `INSERT INTO plan_permissions (plan_id, permission_id, created_at)
           VALUES ($1, $2, NOW())`,
          [planId, permId],
        );
      }
    }

    // 3.b) plan_limits (tabla = fuente de verdad)
    for (const lim of plan.limits) {
      const existsLim = await dataSource.query(
        `SELECT id FROM plan_limits WHERE plan_id = $1 AND vertical = $2 AND code = $3`,
        [planId, lim.vertical, lim.code],
      );
      if (existsLim.length === 0) {
        await dataSource.query(
          `INSERT INTO plan_limits (plan_id, vertical, code, value, created_at, updated_at)
           VALUES ($1, $2, $3, $4, NOW(), NOW())`,
          [planId, lim.vertical, lim.code, lim.value],
        );
      } else {
        await dataSource.query(
          `UPDATE plan_limits SET value = $4, updated_at = NOW()
            WHERE plan_id = $1 AND vertical = $2 AND code = $3`,
          [planId, lim.vertical, lim.code, lim.value],
        );
      }
    }

    // 3.c) Materializar jsonb desde la tabla (sync hook nativo en SQL)
    await dataSource.query(
      `
      UPDATE plans
         SET limits = COALESCE((
           SELECT jsonb_object_agg(vertical, perv)
             FROM (
               SELECT vertical,
                      jsonb_object_agg(code, value) AS perv
                 FROM plan_limits
                WHERE plan_id = $1
                GROUP BY vertical
             ) t
         ), '{}'::jsonb),
         updated_at = NOW()
       WHERE id = $1
      `,
      [planId],
    );
  }

  logger.log('✅ Seed plans-v2 (Sprint A) completado');
}
