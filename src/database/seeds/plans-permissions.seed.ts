import { Logger } from '@nestjs/common';
import dataSource from '../data-source';

const logger = new Logger('PlansPermissionsSeed');

export async function seedPlansAndPermissions(): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  // Insertar los 4 planes base
  const plans = [
    { name: 'Free', price: 0, interval: 'month', is_active: true },
    { name: 'Basic', price: 10, interval: 'month', is_active: true },
    { name: 'Business', price: 100, interval: 'month', is_active: true },
    { name: 'Enterprise', price: 1000, interval: 'month', is_active: true },
  ];
  const planIds: Record<string, string> = {};
  for (const plan of plans) {
    let res = await dataSource.query(
      `SELECT id FROM plans WHERE LOWER(name) = LOWER($1)`,
      [plan.name],
    );
    if (res.length === 0) {
      res = await dataSource.query(
        `INSERT INTO plans (name, price, interval, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, NOW(), NOW()) RETURNING id`,
        [plan.name, plan.price, plan.interval, plan.is_active],
      );
      logger.log(`Plan "${plan.name}" creado`);
    } else {
      logger.log(`Plan "${plan.name}" ya existe`);
    }
    planIds[plan.name] = res[0].id;
  }

  // Insertar todos los permisos base esperados por los tests
  const permissions = [
    { code: 'plans.read', description: 'Leer planes' },
    { code: 'plans.write', description: 'Crear/editar planes' },
    { code: 'permissions.read', description: 'Leer permisos' },
    { code: 'permissions.write', description: 'Crear/editar permisos' },
    { code: 'trucks.read', description: 'Leer camiones' },
    { code: 'trucks.write', description: 'Crear/editar camiones' },
    { code: 'drivers.read', description: 'Leer conductores' },
    { code: 'drivers.write', description: 'Crear/editar conductores' },
    { code: 'shipments.read', description: 'Leer envíos' },
    { code: 'shipments.write', description: 'Crear/editar envíos' },
    { code: 'reports.advanced', description: 'Reportes avanzados' },
    { code: 'settings.billing', description: 'Configuración de facturación' },
  ];
  const permIds: Record<string, string> = {};
  for (const perm of permissions) {
    let exists = await dataSource.query(
      `SELECT id FROM permission_definitions WHERE LOWER(code) = LOWER($1)`,
      [perm.code],
    );
    if (exists.length === 0) {
      exists = await dataSource.query(
        `INSERT INTO permission_definitions (code, description, created_at, updated_at) VALUES ($1, $2, NOW(), NOW()) RETURNING id`,
        [perm.code, perm.description],
      );
      logger.log(`Permiso ${perm.code} creado`);
    }
    permIds[perm.code] = exists[0].id;
  }

  // Relacionar permisos a cada plan según lógica de negocio (ejemplo: todos los permisos para Business y Enterprise)
  const planPermMap: Record<string, string[]> = {
    Free: ['plans.read', 'permissions.read'],
    Basic: [
      'plans.read',
      'permissions.read',
      'trucks.read',
      'drivers.read',
      'shipments.read',
    ],
    Business: permissions.map((p) => p.code), // todos los permisos
    Enterprise: permissions.map((p) => p.code), // todos los permisos
  };
  for (const planName of Object.keys(planPermMap)) {
    const planId = planIds[planName];
    for (const permCode of planPermMap[planName]) {
      const permId = permIds[permCode];
      if (!permId) continue;
      const exists = await dataSource.query(
        `SELECT id FROM plan_permissions WHERE plan_id = $1 AND permission_id = $2`,
        [planId, permId],
      );
      if (exists.length === 0) {
        await dataSource.query(
          `INSERT INTO plan_permissions (plan_id, permission_id, created_at) VALUES ($1, $2, NOW())`,
          [planId, permId],
        );
        logger.log(`Permiso ${permCode} asignado a plan ${planName}`);
      }
    }
  }

  logger.log('✅ Seed de planes y permisos completado');
}
