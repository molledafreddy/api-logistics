import { DataSource } from 'typeorm';
import { Plan } from '../modules/plans/entities/plan.entity';
import { PermissionDefinition } from '../modules/plans/entities/permission-definition.entity';
import { PlanPermission } from '../modules/plans/entities/plan-permission.entity';
import { config as dotenvConfig } from 'dotenv';

dotenvConfig({ path: '.env.development' });

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Plan, PermissionDefinition, PlanPermission],
  synchronize: false,
  ssl: { rejectUnauthorized: false },
});

async function seed() {
  await AppDataSource.initialize();

  // Seed Plans
  const plans = [
    { name: 'Básico', description: 'Plan básico', isActive: true },
    { name: 'Pro', description: 'Plan profesional', isActive: true },
    { name: 'Enterprise', description: 'Plan empresarial', isActive: true },
  ];
  const planRepo = AppDataSource.getRepository(Plan);
  const planEntities = await planRepo.save(plans);

  // Seed Permissions
  const permissions = [
    { code: 'users.read', description: 'Leer usuarios' },
    { code: 'users.write', description: 'Modificar usuarios' },
    { code: 'orders.read', description: 'Leer órdenes' },
    { code: 'orders.write', description: 'Modificar órdenes' },
  ];
  const permRepo = AppDataSource.getRepository(PermissionDefinition);
  const permEntities = await permRepo.save(permissions);

  // Seed Plan-Permission assignments (example: Básico solo lectura, Pro y Enterprise todo)
  const planPermRepo = AppDataSource.getRepository(PlanPermission);
  const assignments = [
    // Básico: solo lectura
    { plan: planEntities[0], permission: permEntities[0] },
    { plan: planEntities[0], permission: permEntities[2] },
    // Pro: todo
    ...permEntities.map((perm) => ({
      plan: planEntities[1],
      permission: perm,
    })),
    // Enterprise: todo
    ...permEntities.map((perm) => ({
      plan: planEntities[2],
      permission: perm,
    })),
  ];
  await planPermRepo.save(assignments);

  console.log('Seeds ejecutados correctamente.');
  await AppDataSource.destroy();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
