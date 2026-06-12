import { Logger } from '@nestjs/common';
import dataSource from '../data-source';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

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
      // Always update password_hash and role
      await dataSource.query(
        `UPDATE users SET role = 'super_admin', password_hash = $1 WHERE id = $2`,
        [hashedPassword, user.id],
      );
      logger.log(`✅ Super admin user updated: ${superAdminEmail}`);
    } else {
      // Create new super_admin
      const superAdminUid = uuidv4();
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
      // Always update password_hash for existing test user
      await dataSource.query(
        `UPDATE users SET password_hash = $1 WHERE id = $2`,
        [hashedPassword, existingTestUser[0].id],
      );
      logger.log(`✅ Test user updated: ${testUserEmail}`);
    } else {
      const testUserUid = uuidv4();
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
       WHERE company_id = $1 AND plan_id = $2
       LIMIT 1`,
      [companyId, businessPlanId],
    );

    if (subscription.length === 0) {
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // +30 days

      await dataSource.query(
        `INSERT INTO subscriptions (
          company_id, plan_id, status,
          current_period_start, current_period_end,
          created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        [companyId, businessPlanId, 'active', now, periodEnd],
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
