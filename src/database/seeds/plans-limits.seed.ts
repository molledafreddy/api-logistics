import { Logger } from '@nestjs/common';
import dataSource from '../data-source';

const logger = new Logger('PlansLimitsSeed');

export async function seedPlansLimits(): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  // Obtener planes existentes
  const plans = await dataSource.query('SELECT id, name FROM plans');
  const planMap = Object.fromEntries(plans.map((p: any) => [p.name, p.id]));

  // Definir límites por vertical y plan
  const limits = [
    // Ejemplo vertical: trucking
    { plan: 'Free', vertical: 'trucking', code: 'max_trucks', value: 1 },
    { plan: 'Basic', vertical: 'trucking', code: 'max_trucks', value: 10 },
    { plan: 'Business', vertical: 'trucking', code: 'max_trucks', value: 100 },
    {
      plan: 'Enterprise',
      vertical: 'trucking',
      code: 'max_trucks',
      value: 1000,
    },
    // Ejemplo vertical: delivery
    { plan: 'Free', vertical: 'delivery', code: 'max_drivers', value: 1 },
    { plan: 'Basic', vertical: 'delivery', code: 'max_drivers', value: 10 },
    { plan: 'Business', vertical: 'delivery', code: 'max_drivers', value: 100 },
    {
      plan: 'Enterprise',
      vertical: 'delivery',
      code: 'max_drivers',
      value: 1000,
    },
  ];

  for (const limit of limits) {
    const planId = planMap[limit.plan];
    if (!planId) continue;
    const exists = await dataSource.query(
      `SELECT id FROM plan_limits WHERE "plan_id" = $1 AND vertical = $2 AND code = $3`,
      [planId, limit.vertical, limit.code],
    );
    if (exists.length === 0) {
      await dataSource.query(
        `INSERT INTO plan_limits ("plan_id", vertical, code, value, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [planId, limit.vertical, limit.code, limit.value],
      );
      logger.log(
        `Límite ${limit.code} (${limit.vertical}) asignado a plan ${limit.plan}`,
      );
    }
  }

  logger.log('✅ Seed de límites de planes completado');
}
