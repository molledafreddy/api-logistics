import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { Plan } from '../src/modules/plans/entities/plan.entity';
import { PermissionDefinition } from '../src/modules/plans/entities/permission-definition.entity';
import { PlanPermission } from '../src/modules/plans/entities/plan-permission.entity';

async function seed() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const dataSource = app.get(DataSource);

  // 1. Crear planes base
  const plans = [
    { name: 'Free', code: 'free', price: 0 },
    { name: 'Basic', code: 'basic', price: 49 },
    { name: 'Business', code: 'business', price: 149 },
    { name: 'Enterprise', code: 'enterprise', price: 499 },
  ];
  const planEntities = [];
  for (const plan of plans) {
    let planEntity = await dataSource
      .getRepository(Plan)
      .findOneBy({ name: plan.name });
    if (!planEntity) {
      planEntity = dataSource.getRepository(Plan).create(plan);
      await dataSource.getRepository(Plan).save(planEntity);
    }
    planEntities.push(planEntity);
  }

  // 2. Crear permisos base
  const permissions = [
    { code: 'trucks.read', description: 'Ver camiones' },
    { code: 'trucks.write', description: 'Gestionar camiones' },
    { code: 'drivers.read', description: 'Ver conductores' },
    { code: 'drivers.write', description: 'Gestionar conductores' },
    { code: 'shipments.read', description: 'Ver envíos' },
    { code: 'shipments.write', description: 'Gestionar envíos' },
    { code: 'reports.advanced', description: 'Acceso a reportes avanzados' },
    { code: 'settings.billing', description: 'Gestionar facturación' },
  ];
  const permissionEntities = [];
  for (const perm of permissions) {
    let permEntity = await dataSource
      .getRepository(PermissionDefinition)
      .findOneBy({ code: perm.code });
    if (!permEntity) {
      permEntity = dataSource.getRepository(PermissionDefinition).create(perm);
      await dataSource.getRepository(PermissionDefinition).save(permEntity);
    }
    permissionEntities.push(permEntity);
  }

  // 3. Relacionar planes con permisos (ejemplo simple)
  const planPermissions = [
    // Free
    { plan: 'free', perms: ['trucks.read', 'drivers.read', 'shipments.read'] },
    // Basic
    {
      plan: 'basic',
      perms: [
        'trucks.read',
        'trucks.write',
        'drivers.read',
        'drivers.write',
        'shipments.read',
        'shipments.write',
      ],
    },
    // Business
    {
      plan: 'business',
      perms: [
        'trucks.read',
        'trucks.write',
        'drivers.read',
        'drivers.write',
        'shipments.read',
        'shipments.write',
        'reports.advanced',
        'settings.billing',
      ],
    },
    // Enterprise
    { plan: 'enterprise', perms: permissions.map((p) => p.code) },
  ];
  for (const pp of planPermissions) {
    const plan = planEntities.find((p) => p.name.toLowerCase() === pp.plan);
    for (const permCode of pp.perms) {
      const perm = permissionEntities.find((p) => p.code === permCode);
      if (!plan || !perm) continue;
      const exists = await dataSource
        .getRepository(PlanPermission)
        .findOneBy({ plan: { id: plan.id }, permission: { id: perm.id } });
      if (!exists) {
        const planPerm = dataSource
          .getRepository(PlanPermission)
          .create({ plan, permission: perm });
        await dataSource.getRepository(PlanPermission).save(planPerm);
      }
    }
  }

  await app.close();
  console.log('✅ Seeds de planes, permisos y relaciones completados.');
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
