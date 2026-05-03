import { DataSource } from 'typeorm';

export async function seedPlansLimitsOptimizer(
  dataSource: DataSource,
): Promise<void> {
  // Actualiza los límites de optimización para los planes legacy
  await dataSource.query(`
    UPDATE plans SET limits = jsonb_set(limits, '{maxStopsPerOptimization}', '25', true) WHERE code = 'free_legacy';
    UPDATE plans SET limits = jsonb_set(limits, '{maxReoptimizationsPerDay}', '5', true) WHERE code = 'free_legacy';
    UPDATE plans SET limits = jsonb_set(limits, '{maxStopsPerOptimization}', '200', true) WHERE code = 'basic_legacy';
    UPDATE plans SET limits = jsonb_set(limits, '{maxReoptimizationsPerDay}', '20', true) WHERE code = 'basic_legacy';
    UPDATE plans SET limits = jsonb_set(limits, '{maxStopsPerOptimization}', '100', true) WHERE code = 'business_legacy';
    UPDATE plans SET limits = jsonb_set(limits, '{maxReoptimizationsPerDay}', '10', true) WHERE code = 'business_legacy';
    UPDATE plans SET limits = jsonb_set(limits, '{maxStopsPerOptimization}', '1000', true) WHERE code = 'enterprise_legacy';
    UPDATE plans SET limits = jsonb_set(limits, '{maxReoptimizationsPerDay}', '100', true) WHERE code = 'enterprise_legacy';
  `);
  console.log('✅ Seed de límites de optimización ejecutado');
}
