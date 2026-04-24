import { Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import dataSource from '../data-source';

const logger = new Logger('TestUserSeed');

export async function seedTestUser() {
  const email = 'molledafreddy@gmail.com';
  const password = 'MyP@ssw0rd!';
  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !serviceRoleKey) {
    logger.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Missing Supabase config');
  }

  // ─── Crear usuario en Supabase ───
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  let authUser;
  let data, error;
  try {
    const res = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    data = res.data;
    error = res.error;
    authUser = data?.user;
  } catch (err: any) {
    if (err?.code === 'email_exists' || err?.status === 422) {
      logger.warn('Usuario ya existe en Supabase, se usará el existente');
    } else {
      logger.error('Error creando usuario en Supabase', err);
      throw err;
    }
  }
  if (!authUser) {
    // Buscar usuario existente (listUsers no acepta email, filtrar manualmente)
    const { data: userData } = await supabase.auth.admin.listUsers();
    authUser = userData?.users?.find(
      (u: any) => u.email?.toLowerCase() === email,
    );
  }
  if (!authUser)
    throw new Error('No se pudo crear ni encontrar el usuario en Supabase');

  // ─── Crear usuario local ───
  if (!dataSource.isInitialized) await dataSource.initialize();
  const existing = await dataSource.query(
    `SELECT id FROM users WHERE email = $1`,
    [email],
  );
  // Buscar específicamente "Test Company" y crearla si no existe
  let company = await dataSource.query(
    `SELECT id FROM companies WHERE name = $1`,
    ['Test Company'],
  );
  if (company.length === 0) {
    const c = await dataSource.query(
      `INSERT INTO companies (name, type, status, created_at, updated_at) VALUES ($1, $2, $3, NOW(), NOW()) RETURNING id`,
      ['Test Company', 'shipper', 'active'],
    );
    company = c;
  }
  const plan = await dataSource.query(`SELECT id FROM plans WHERE name = $1`, [
    'Business',
  ]);
  const planId = plan[0]?.id;

  // Crear usuario si no existe
  if (existing.length === 0) {
    await dataSource.query(
      `INSERT INTO users (auth_uid, company_id, email, first_name, last_name, role, status, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
      [
        authUser.id,
        company[0].id,
        email,
        'Freddy',
        'Molleda',
        'super_admin',
        'active',
      ],
    );
    logger.log('Usuario de pruebas creado');
  } else {
    logger.log('Usuario de pruebas ya existe');
  }

  // Siempre asegurar que exista una suscripción activa para el usuario
  if (planId) {
    // Asociar la suscripción a la empresa (company_id) en vez de user_id
    const companyId = company[0]?.id;
    if (companyId) {
      const subExists = await dataSource.query(
        `SELECT id FROM subscriptions WHERE company_id = $1 AND plan_id = $2`,
        [companyId, planId],
      );
      if (subExists.length === 0) {
        const now = new Date();
        const nextMonth = new Date(now);
        nextMonth.setMonth(now.getMonth() + 1);
        await dataSource.query(
          `INSERT INTO subscriptions (company_id, plan_id, status, current_period_start, current_period_end, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
          [companyId, planId, 'active', now, nextMonth],
        );
        logger.log('Suscripción de prueba creada para la empresa');
      } else {
        logger.log('Suscripción de prueba ya existe para la empresa');
      }
    }
  }
}
