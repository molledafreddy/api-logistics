import { MigrationInterface, QueryRunner } from 'typeorm';

export class SeedPlanLimitsForOptimizer1714500000000 implements MigrationInterface {
  name = 'SeedPlanLimitsForOptimizer1714500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ejemplo de límites por tipo de plan (ajusta según tus necesidades)
    await queryRunner.query(`
      UPDATE plans SET limits = jsonb_set(limits, '{maxStopsPerOptimization}', '25', true) WHERE code = 'free_legacy';
      UPDATE plans SET limits = jsonb_set(limits, '{maxReoptimizationsPerDay}', '5', true) WHERE code = 'free_legacy';
      UPDATE plans SET limits = jsonb_set(limits, '{maxStopsPerOptimization}', '200', true) WHERE code = 'basic_legacy';
      UPDATE plans SET limits = jsonb_set(limits, '{maxReoptimizationsPerDay}', '20', true) WHERE code = 'basic_legacy';
      UPDATE plans SET limits = jsonb_set(limits, '{maxStopsPerOptimization}', '100', true) WHERE code = 'business_legacy';
      UPDATE plans SET limits = jsonb_set(limits, '{maxReoptimizationsPerDay}', '10', true) WHERE code = 'business_legacy';
      UPDATE plans SET limits = jsonb_set(limits, '{maxStopsPerOptimization}', '1000', true) WHERE code = 'enterprise_legacy';
      UPDATE plans SET limits = jsonb_set(limits, '{maxReoptimizationsPerDay}', '100', true) WHERE code = 'enterprise_legacy';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE plans SET limits = limits - 'maxStopsPerOptimization' - 'maxReoptimizationsPerDay';
    `);
  }
}
