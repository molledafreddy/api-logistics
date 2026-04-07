import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEnums1700000000002 implements MigrationInterface {
  name = 'CreateEnums1700000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Company types
    await queryRunner.query(`
      CREATE TYPE company_type_enum AS ENUM ('shipper', 'carrier', 'broker')
    `);

    // Company statuses
    await queryRunner.query(`
      CREATE TYPE company_status_enum AS ENUM ('pending_verification', 'active', 'suspended', 'inactive')
    `);

    // User roles
    await queryRunner.query(`
      CREATE TYPE user_role_enum AS ENUM (
        'super_admin', 'company_owner', 'admin', 'manager',
        'dispatcher', 'driver', 'accountant', 'viewer'
      )
    `);

    // User statuses
    await queryRunner.query(`
      CREATE TYPE user_status_enum AS ENUM ('pending_verification', 'active', 'suspended', 'inactive')
    `);

    // Subscription statuses
    await queryRunner.query(`
      CREATE TYPE subscription_status_enum AS ENUM ('trialing', 'active', 'past_due', 'canceled', 'expired')
    `);

    // Plan tiers
    await queryRunner.query(`
      CREATE TYPE plan_tier_enum AS ENUM ('free', 'starter', 'professional', 'enterprise')
    `);

    // Shipment statuses
    await queryRunner.query(`
      CREATE TYPE shipment_status_enum AS ENUM (
        'draft', 'quoted', 'confirmed', 'assigned', 'picked_up',
        'in_transit', 'at_stop', 'delivered', 'pod_uploaded',
        'completed', 'cancelled', 'incident'
      )
    `);

    // Truck statuses
    await queryRunner.query(`
      CREATE TYPE truck_status_enum AS ENUM ('available', 'in_transit', 'maintenance', 'out_of_service')
    `);

    // Driver statuses
    await queryRunner.query(`
      CREATE TYPE driver_status_enum AS ENUM ('available', 'on_trip', 'off_duty', 'suspended')
    `);

    // Relationship statuses
    await queryRunner.query(`
      CREATE TYPE relationship_status_enum AS ENUM ('pending', 'accepted', 'rejected', 'blocked')
    `);

    // Expense statuses
    await queryRunner.query(`
      CREATE TYPE expense_status_enum AS ENUM ('pending', 'approved', 'rejected', 'reimbursed')
    `);

    // Verification statuses
    await queryRunner.query(`
      CREATE TYPE verification_status_enum AS ENUM ('not_started', 'pending', 'in_review', 'approved', 'rejected', 'expired')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TYPE IF EXISTS verification_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS expense_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS relationship_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS driver_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS truck_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS shipment_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS plan_tier_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS subscription_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS user_role_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS company_status_enum`);
    await queryRunner.query(`DROP TYPE IF EXISTS company_type_enum`);
  }
}
