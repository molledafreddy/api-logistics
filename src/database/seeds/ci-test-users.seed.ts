import { Logger } from '@nestjs/common';
import dataSource from '../data-source';
import * as bcrypt from 'bcrypt';

const logger = new Logger('CITestUsersSeed');

/**
 * CI/CD Test Users Seed
 *
 * Creates test users directly in PostgreSQL (no Supabase dependency).
 * Used only in CI/CD environments where Supabase is not available.
 *
 * Creates:
 * - Super admin user (admin@test.com)
 * - Regular test user (test@test.com)
 *
 * Both with password: TestPassword123!
 */
export async function seedCITestUsers(): Promise<void> {
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  const superAdminEmail = 'admin@test.com';
  const testUserEmail = 'test@test.com';
  const password = 'TestPassword123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  try {
    // ─── Create Test Company ────
    let company = await dataSource.query(
      `SELECT id FROM companies WHERE name = $1 AND deleted_at IS NULL`,
      ['CI Test Company'],
    );

    if (company.length === 0) {
      company = await dataSource.query(
        `INSERT INTO companies (name, type, status, created_at, updated_at) 
         VALUES ($1, $2, $3, NOW(), NOW()) 
         RETURNING id`,
        ['CI Test Company', 'shipper', 'active'],
      );
      logger.log('✅ CI Test Company created');
    } else {
      logger.log('✅ CI Test Company already exists');
    }

    const companyId = company[0].id;

    // ─── Get Plans ────
    const businessPlan = await dataSource.query(
      `SELECT id FROM plans WHERE name = $1`,
      ['Business'],
    );
    const businessPlanId = businessPlan[0]?.id;

    if (!businessPlanId) {
      logger.error(
        'Business plan not found. Run plans-permissions seed first.',
      );
      throw new Error('Business plan not found');
    }

    // ─── Create Super Admin User ────
    const existingAdmin = await dataSource.query(
      `SELECT id, role FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [superAdminEmail],
    );

    if (existingAdmin.length > 0) {
      const user = existingAdmin[0];
      if (user.role === 'super_admin') {
        logger.log(`✅ Super admin user already exists: ${superAdminEmail}`);
      } else {
        // Promote to super_admin
        await dataSource.query(
          `UPDATE users SET role = 'super_admin' WHERE id = $1`,
          [user.id],
        );
        logger.log(`✅ User promoted to super_admin: ${superAdminEmail}`);
      }
    } else {
      // Create new super_admin
      const superAdminUid = `ci-super-admin-${Date.now()}`;
      await dataSource.query(
        `INSERT INTO users (
          auth_uid, company_id, email, first_name, last_name, 
          role, status, password_hash, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          superAdminUid,
          companyId,
          superAdminEmail,
          'Super',
          'Admin',
          'super_admin',
          'active',
          hashedPassword,
        ],
      );
      logger.log(`✅ Super admin user created: ${superAdminEmail}`);
    }

    // ─── Create Regular Test User ────
    const existingTestUser = await dataSource.query(
      `SELECT id FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [testUserEmail],
    );

    if (existingTestUser.length > 0) {
      logger.log(`✅ Test user already exists: ${testUserEmail}`);
    } else {
      const testUserUid = `ci-test-user-${Date.now()}`;
      await dataSource.query(
        `INSERT INTO users (
          auth_uid, company_id, email, first_name, last_name, 
          role, status, password_hash, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
        [
          testUserUid,
          companyId,
          testUserEmail,
          'Test',
          'User',
          'manager',
          'active',
          hashedPassword,
        ],
      );
      logger.log(`✅ Test user created: ${testUserEmail}`);
    }

    // ─── Create Subscription for Test User ────
    const subscription = await dataSource.query(
      `SELECT id FROM subscriptions 
       WHERE company_id = $1 AND plan_id = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [companyId, businessPlanId],
    );

    if (subscription.length === 0) {
      await dataSource.query(
        `INSERT INTO subscriptions (
          company_id, plan_id, status, billing_cycle, 
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [companyId, businessPlanId, 'active', 'monthly'],
      );
      logger.log(`✅ Business subscription created for CI Test Company`);
    } else {
      logger.log(`✅ Subscription already exists for CI Test Company`);
    }

    logger.log('✅ CI test users seed completed successfully');
  } catch (error) {
    logger.error('❌ CI test users seed failed:', error);
    throw error;
  }
}
