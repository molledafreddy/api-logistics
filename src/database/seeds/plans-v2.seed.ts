import { Logger } from '@nestjs/common';
import dataSource from '../data-source';

const logger = new Logger('PlansV2Seed');

/**
 * Sprint A (rev 2) — Catálogo de 7 planes verticalizados + permisos ampliados.
 *
 * Rutas de crecimiento:
 *   COURIER:   free_courier → pro_courier → enterprise_courier → enterprise_fleet
 *   PASSENGER: free_passenger → pro_passenger → enterprise_passenger → enterprise_fleet
 *
 * enterprise_fleet es el plan unificado (audience=any) que habilita ambos verticales.
 *
 * Idempotente: puede correrse múltiples veces sin duplicar.
 */
export async function seedPlansV2(): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  type LimitSpec = { vertical: string; code: string; value: number };
  type PlanSpec = {
    code: string;
    name: string;
    description: string;
    audience: 'courier' | 'passenger' | 'fleet' | 'any';
    tier: 'free' | 'pro' | 'enterprise';
    price: number;
    interval: string;
    limits: LimitSpec[];
    permissions: string[];
  };

  // ─── Permisos ────────────────────────────────────────────────────
  const newPermissions = [
    {
      code: 'optimization.basic',
      description: 'Optimización de rutas básica (Nearest Neighbor)',
    },
    {
      code: 'optimization.advanced',
      description: 'Optimización avanzada (NN + 2-opt) vía Mapbox',
    },
    {
      code: 'optimization.google_maps',
      description: 'Optimización con Google Maps Routes API',
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
    { code: 'templates.basic', description: 'Crear plantillas de recurrencia' },
    {
      code: 'network.receive_packages',
      description: 'Recibir paquetes de otros couriers de la red',
    },
    {
      code: 'network.publish_packages',
      description: 'Publicar paquetes para que otros couriers los tomen',
    },
    {
      code: 'passenger.recurring',
      description: 'Plantillas de viajes recurrentes (pasajeros)',
    },
    {
      code: 'passenger.manifest',
      description: 'Manifiestos de pasajeros por viaje',
    },
    {
      code: 'tracking.public_link',
      description: 'Link público de tracking del envío',
    },
    {
      code: 'tracking.realtime',
      description: 'Tracking en tiempo real de ubicación del conductor',
    },
    {
      code: 'tracking.proximity_alerts',
      description:
        'Alertas automáticas por proximidad a punto de entrega/recogida',
    },
    {
      code: 'reports.advanced',
      description: 'Reportes avanzados de operación y rendimiento',
    },
    {
      code: 'settings.billing',
      description: 'Gestión de facturación y suscripción',
    },
    {
      code: 'dashboard.view',
      description: 'Ver dashboard de métricas y KPIs de la empresa',
    },
    {
      code: 'chat.internal',
      description:
        'Acceso al módulo de chat interno entre usuarios de la empresa',
    },
    {
      code: 'referrals.generate',
      description: 'Generar links de referido para invitar nuevas empresas',
    },
  ];

  // ─── Planes ──────────────────────────────────────────────────────
  const plans: PlanSpec[] = [
    // ── COURIER ──────────────────────────────────────────────────
    {
      code: 'free_courier',
      name: 'Free Courier',
      description:
        'Para transportistas independientes que están comenzando. 1 conductor, 1 vehículo.',
      audience: 'courier',
      tier: 'free',
      price: 0,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 6 },
        { vertical: 'global', code: 'max_drivers', value: 1 },
        { vertical: 'global', code: 'max_users', value: 1 },
        { vertical: 'global', code: 'max_templates', value: 0 },
        { vertical: 'trucking', code: 'max_trucks', value: 1 },
      ],
      permissions: ['shipments.read', 'shipments.write', 'drivers.read'],
    },
    {
      code: 'pro_courier',
      name: 'Pro Courier',
      description:
        'Mayor capacidad de envíos, optimización de rutas con Mapbox y plantillas básicas.',
      audience: 'courier',
      tier: 'pro',
      price: 9990,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 200 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 50 },
        { vertical: 'global', code: 'max_drivers', value: 1 },
        { vertical: 'global', code: 'max_users', value: 1 },
        { vertical: 'global', code: 'max_templates', value: 2 },
        { vertical: 'trucking', code: 'max_trucks', value: 1 },
      ],
      permissions: [
        'shipments.read',
        'shipments.write',
        'drivers.read',
        'optimization.basic',
        'optimization.advanced',
        'templates.basic',
        'tracking.public_link',
        'dashboard.view',
        'chat.internal',
        'referrals.generate',
      ],
    },
    {
      code: 'enterprise_courier',
      name: 'Enterprise Courier',
      description:
        'Couriers en crecimiento: más capacidad, Google Maps, red de paquetes y equipo.',
      audience: 'courier',
      tier: 'enterprise',
      price: 39990,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 1000 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 150 },
        { vertical: 'global', code: 'max_drivers', value: 15 },
        { vertical: 'global', code: 'max_users', value: 15 },
        { vertical: 'global', code: 'max_templates', value: 30 },
        { vertical: 'trucking', code: 'max_trucks', value: 15 },
      ],
      permissions: [
        'shipments.read',
        'shipments.write',
        'drivers.read',
        'drivers.write',
        'trucks.read',
        'trucks.write',
        'optimization.basic',
        'optimization.advanced',
        'optimization.google_maps',
        'optimization.reoptimize',
        'routes.multi_driver',
        'templates.basic',
        'network.receive_packages',
        'tracking.public_link',
        'tracking.realtime',
        'tracking.proximity_alerts',
        'reports.advanced',
        'settings.billing',
        'dashboard.view',
        'chat.internal',
        'referrals.generate',
      ],
    },

    // ── PASSENGER ────────────────────────────────────────────────
    {
      code: 'free_passenger',
      name: 'Free Passenger',
      description:
        'Para transportistas de pasajeros individuales que están comenzando.',
      audience: 'passenger',
      tier: 'free',
      price: 0,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 6 },
        { vertical: 'global', code: 'max_drivers', value: 1 },
        { vertical: 'global', code: 'max_users', value: 1 },
        { vertical: 'global', code: 'max_templates', value: 0 },
        { vertical: 'trucking', code: 'max_trucks', value: 1 },
      ],
      permissions: ['shipments.read', 'drivers.read'],
    },
    {
      code: 'pro_passenger',
      name: 'Pro Passenger',
      description:
        'Mayor capacidad, optimización con Mapbox, plantillas recurrentes y manifiestos.',
      audience: 'passenger',
      tier: 'pro',
      price: 14990,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 100 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 30 },
        { vertical: 'global', code: 'max_drivers', value: 1 },
        { vertical: 'global', code: 'max_users', value: 1 },
        { vertical: 'global', code: 'max_templates', value: 2 },
        { vertical: 'trucking', code: 'max_trucks', value: 1 },
      ],
      permissions: [
        'shipments.read',
        'shipments.write',
        'drivers.read',
        'optimization.basic',
        'optimization.advanced',
        'templates.basic',
        'passenger.recurring',
        'passenger.manifest',
        'tracking.public_link',
        'dashboard.view',
        'chat.internal',
        'referrals.generate',
      ],
    },
    {
      code: 'enterprise_passenger',
      name: 'Enterprise Passenger',
      description:
        'Empresas de transporte de personas: Google Maps, equipo completo y manifiestos avanzados.',
      audience: 'passenger',
      tier: 'enterprise',
      price: 44990,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 1000 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 150 },
        { vertical: 'global', code: 'max_drivers', value: 15 },
        { vertical: 'global', code: 'max_users', value: 15 },
        { vertical: 'global', code: 'max_templates', value: 99999 },
        { vertical: 'trucking', code: 'max_trucks', value: 15 },
      ],
      permissions: [
        'shipments.read',
        'shipments.write',
        'drivers.read',
        'drivers.write',
        'trucks.read',
        'trucks.write',
        'optimization.basic',
        'optimization.advanced',
        'optimization.google_maps',
        'optimization.reoptimize',
        'routes.multi_driver',
        'templates.basic',
        'network.receive_packages',
        'passenger.recurring',
        'passenger.manifest',
        'tracking.public_link',
        'tracking.realtime',
        'tracking.proximity_alerts',
        'reports.advanced',
        'settings.billing',
        'dashboard.view',
        'chat.internal',
        'referrals.generate',
      ],
    },

    // ── FLEET (unificado) ─────────────────────────────────────────
    {
      code: 'enterprise_fleet',
      name: 'Enterprise Fleet',
      description:
        'Plan unificado para flotas con operación mixta (carga + pasajeros). Todos los permisos.',
      audience: 'any',
      tier: 'enterprise',
      price: 99990,
      interval: 'month',
      limits: [
        { vertical: 'global', code: 'maxShipmentsPerDay', value: 100000 },
        { vertical: 'global', code: 'maxStopsPerOptimization', value: 500 },
        { vertical: 'global', code: 'max_drivers', value: 99999 },
        { vertical: 'global', code: 'max_users', value: 99999 },
        { vertical: 'global', code: 'max_templates', value: 99999 },
        { vertical: 'trucking', code: 'max_trucks', value: 99999 },
      ],
      permissions: [
        'shipments.read',
        'shipments.write',
        'drivers.read',
        'drivers.write',
        'trucks.read',
        'trucks.write',
        'optimization.basic',
        'optimization.advanced',
        'optimization.google_maps',
        'optimization.vrp',
        'optimization.reoptimize',
        'routes.multi_driver',
        'templates.basic',
        'network.receive_packages',
        'network.publish_packages',
        'passenger.recurring',
        'passenger.manifest',
        'tracking.public_link',
        'tracking.realtime',
        'tracking.proximity_alerts',
        'reports.advanced',
        'settings.billing',
        'dashboard.view',
        'chat.internal',
        'referrals.generate',
      ],
    },
  ];

  // ─── 1. Permisos (idempotente) ───────────────────────────────────
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
    } else {
      await dataSource.query(
        `UPDATE permission_definitions SET description = $2, updated_at = NOW() WHERE code = $1`,
        [p.code, p.description],
      );
    }
  }

  const allPermCodes = Array.from(new Set(plans.flatMap((p) => p.permissions)));
  const permRows: Array<{ id: string; code: string }> = await dataSource.query(
    `SELECT id, code FROM permission_definitions WHERE code = ANY($1)`,
    [allPermCodes],
  );
  const permIdByCode: Record<string, string> = Object.fromEntries(
    permRows.map((r) => [r.code, r.id]),
  );

  // ─── 2. Planes + plan_permissions + plan_limits + jsonb ──────────
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

    // 2.a) plan_permissions — reemplaza el set completo para garantizar coherencia
    await dataSource.query(`DELETE FROM plan_permissions WHERE plan_id = $1`, [
      planId,
    ]);
    for (const code of plan.permissions) {
      const permId = permIdByCode[code];
      if (!permId) {
        logger.warn(
          `⚠️  Permiso "${code}" no existe; se omite en ${plan.code}`,
        );
        continue;
      }
      await dataSource.query(
        `INSERT INTO plan_permissions (plan_id, permission_id, created_at)
         VALUES ($1, $2, NOW())`,
        [planId, permId],
      );
    }

    // 2.b) plan_limits (upsert)
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

    // 2.c) Materializar jsonb desde la tabla
    await dataSource.query(
      `UPDATE plans
          SET limits = COALESCE((
            SELECT jsonb_object_agg(vertical, perv)
              FROM (
                SELECT vertical, jsonb_object_agg(code, value) AS perv
                  FROM plan_limits
                 WHERE plan_id = $1
                 GROUP BY vertical
              ) t
          ), '{}'::jsonb),
          updated_at = NOW()
        WHERE id = $1`,
      [planId],
    );
  }

  // ─── 3. Desactivar planes legacy (code IS NULL o no pertenecen al catálogo nuevo) ──
  const newCodes = plans.map((p) => p.code);
  await dataSource.query(
    `UPDATE plans
        SET is_active = false, updated_at = NOW()
      WHERE is_active = true
        AND (code IS NULL OR code != ALL($1::text[]))`,
    [newCodes],
  );
  logger.log('✅ Planes legacy desactivados');

  logger.log('✅ Seed plans-v2 (rev 2 — 7 planes) completado');
}
