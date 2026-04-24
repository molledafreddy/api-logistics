import { Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import dataSource from '../data-source';

const logger = new Logger('SuperAdminSeed');

/**
 * Super Admin seed.
 *
 * Creates a super_admin user in both Supabase Auth and the local users table.
 *
 * Required env variables:
 *   SUPER_ADMIN_EMAIL    — defaults to admin@logistics-api.com
 *   SUPER_ADMIN_PASSWORD — defaults to SuperAdmin1!@#
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Idempotent: if the user already exists, it skips creation.
 */
export async function seedSuperAdmin(): Promise<void> {
  const email = (process.env.SUPER_ADMIN_EMAIL || 'admin@logistics-api.com')
    .toLowerCase()
    .trim();
  const password = process.env.SUPER_ADMIN_PASSWORD || 'SuperAdmin1!@#';
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Missing Supabase config');
  }

  // ─── Initialize datasource if needed ────
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  // ─── Check if super_admin already exists ────
  const existingUser = await dataSource.query(
    `SELECT id, email, role FROM users WHERE email = $1 AND deleted_at IS NULL`,
    [email],
  );

  if (existingUser.length > 0) {
    const user = existingUser[0];
    if (user.role === 'super_admin') {
      logger.log(`✅ Super admin already exists: ${email} (${user.id})`);
      return;
    }
    // User exists but is not super_admin — promote
    await dataSource.query(
      `UPDATE users SET role = 'super_admin' WHERE id = $1`,
      [user.id],
    );
    logger.log(
      `✅ Existing user promoted to super_admin: ${email} (${user.id})`,
    );
    return;
  }

  // ─── Create in Supabase Auth ────
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Check if user exists in Supabase Auth (by email)
  const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
  const authUsers = existingAuthUsers?.users as
    | Array<{ id: string; email?: string }>
    | undefined;
  const existingAuth = authUsers?.find((u) => u.email?.toLowerCase() === email);

  let authUid: string;

  if (existingAuth) {
    authUid = existingAuth.id;
    logger.log(`Supabase auth user already exists: ${authUid}`);
  } else {
    const { data: newAuth, error: authError } =
      await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          first_name: 'Super',
          last_name: 'Admin',
          role: 'super_admin',
        },
      });

    if (authError) {
      logger.error(`Failed to create Supabase auth user: ${authError.message}`);
      throw authError;
    }

    authUid = newAuth.user.id;
    logger.log(`Supabase auth user created: ${authUid}`);
  }

  // ─── Create in local DB ────
  await dataSource.query(
    `INSERT INTO users (
      auth_uid, email, first_name, last_name,
      role, status, timezone, language,
      email_verified_at, created_at, updated_at
    ) VALUES (
      $1, $2, 'Super', 'Admin',
      'super_admin', 'active', 'UTC', 'en',
      NOW(), NOW(), NOW()
    )`,
    [authUid, email],
  );

  logger.log(`✅ Super admin created: ${email}`);
}
