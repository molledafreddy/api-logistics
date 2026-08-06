import { Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import dataSource from '../data-source';

const logger = new Logger('CrossCompanyDemoSeed');

/**
 * Seed para demostrar el workflow de subcontratación cross-empresa.
 * Solo se ejecuta cuando SEED_DEMO=true.
 *
 * Crea:
 *   - 2 empresas: "Acme Shipper" (cliente) y "Swift Carriers" (carrier)
 *   - 1 owner user para cada empresa (con Supabase Auth)
 *   - 1 relación ACCEPTED entre ambas (relationship_type=client_carrier)
 *   - 3 trucks + 3 drivers para Swift Carriers
 *   - 3 shipments cross-company:
 *      • #1 en PENDING_ACCEPTANCE (Acme acaba de proponer)
 *      • #2 en CONFIRMED (Swift aceptó, sin asignar)
 *      • #3 en ASSIGNED (Swift aceptó + asignó truck y driver)
 *
 * Credenciales:
 *   acme@demo.com  / Demo1234!   (owner de Acme Shipper)
 *   swift@demo.com / Demo1234!   (owner de Swift Carriers)
 *
 * Idempotente: re-ejecutarlo no duplica datos.
 */
export async function seedCrossCompanyDemo() {
  if (process.env.SEED_DEMO !== 'true') {
    logger.log('SEED_DEMO no está activo, se omite seeder cross-company');
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !serviceRoleKey) {
    logger.warn(
      'Faltan SUPABASE_URL / SERVICE_ROLE_KEY, se omite seeder cross-company',
    );
    return;
  }

  if (!dataSource.isInitialized) await dataSource.initialize();
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  logger.log('🚚 Sembrando datos cross-company...');

  // ─── 1. Empresas ───────────────────────────
  const acmeId = await upsertCompany('Acme Shipper Demo', 'shipper');
  const swiftId = await upsertCompany('Swift Carriers Demo', 'carrier');
  logger.log(`✓ Companies → Acme=${acmeId}  Swift=${swiftId}`);

  // ─── 2. Usuarios owner ──────────────────────
  const acmeOwnerId = await upsertUserOwner(
    supabase,
    'acme@demo.com',
    'Demo1234!',
    'Acme',
    'Owner',
    acmeId,
  );
  const swiftOwnerId = await upsertUserOwner(
    supabase,
    'swift@demo.com',
    'Demo1234!',
    'Swift',
    'Owner',
    swiftId,
  );
  logger.log(`✓ Owners → Acme user=${acmeOwnerId}  Swift user=${swiftOwnerId}`);

  // ─── 3. Relación accepted entre Acme y Swift ─
  const relExists = await dataSource.query(
    `SELECT id FROM company_relationships
     WHERE parent_company_id = $1 AND child_company_id = $2`,
    [acmeId, swiftId],
  );
  let relId: string;
  if (relExists.length === 0) {
    const r = await dataSource.query(
      `INSERT INTO company_relationships (
        parent_company_id, child_company_id, relationship_type, status,
        invited_by, accepted_at, responded_by, created_at, updated_at
      ) VALUES ($1, $2, 'client_carrier', 'accepted', $3, NOW(), $4, NOW(), NOW())
      RETURNING id`,
      [acmeId, swiftId, acmeOwnerId, swiftOwnerId],
    );
    relId = r[0].id;
    logger.log(
      `✓ Relación client_carrier ACCEPTED entre Acme y Swift creada (${relId})`,
    );
  } else {
    relId = relExists[0].id;
    // Asegurar que esté en accepted (si quedó pending de un seed anterior)
    await dataSource.query(
      `UPDATE company_relationships
       SET status = 'accepted',
           accepted_at = COALESCE(accepted_at, NOW()),
           responded_by = COALESCE(responded_by, $1)
       WHERE id = $2`,
      [swiftOwnerId, relId],
    );
    logger.log(`✓ Relación ya existente, asegurada en ACCEPTED (${relId})`);
  }

  // ─── 4. Trucks y drivers de Swift ───────────
  const trucks = [
    { plate: 'SWIFT-001', make: 'Volvo', model: 'FH16', type: 'dry-van' },
    { plate: 'SWIFT-002', make: 'Scania', model: 'R450', type: 'reefer' },
    { plate: 'SWIFT-003', make: 'Mercedes', model: 'Actros', type: 'flatbed' },
  ];
  const truckIds: Record<string, string> = {};
  for (const t of trucks) {
    const exist = await dataSource.query(
      `SELECT id FROM trucks WHERE company_id = $1 AND plate = $2 AND deleted_at IS NULL`,
      [swiftId, t.plate],
    );
    if (exist.length > 0) {
      truckIds[t.plate] = exist[0].id;
      continue;
    }
    const r = await dataSource.query(
      `INSERT INTO trucks (company_id, plate, make, model, type, status, capacity_kg, year, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,'available',20000,2023,NOW(),NOW()) RETURNING id`,
      [swiftId, t.plate, t.make, t.model, t.type],
    );
    truckIds[t.plate] = r[0].id;
  }
  logger.log(`✓ ${Object.keys(truckIds).length} trucks de Swift listos`);

  const drivers = [
    { license: 'SW-DL-001', first: 'Carlos', last: 'Rivera' },
    { license: 'SW-DL-002', first: 'Ana', last: 'Torres' },
    { license: 'SW-DL-003', first: 'Luis', last: 'Mendoza' },
  ];
  const driverIds: Record<string, string> = {};
  for (const d of drivers) {
    const exist = await dataSource.query(
      `SELECT id FROM drivers WHERE company_id = $1 AND license_number = $2 AND deleted_at IS NULL`,
      [swiftId, d.license],
    );
    if (exist.length > 0) {
      driverIds[d.license] = exist[0].id;
      continue;
    }
    const r = await dataSource.query(
      `INSERT INTO drivers (company_id, first_name, last_name, license_number, license_class, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,'CDL-A','available',NOW(),NOW()) RETURNING id`,
      [swiftId, d.first, d.last, d.license],
    );
    driverIds[d.license] = r[0].id;
  }
  logger.log(`✓ ${Object.keys(driverIds).length} drivers de Swift listos`);

  // ─── 5. Shipments cross-company ─────────────
  // Helper para crear/encontrar shipment por reference_number
  const createShipment = async (
    refNumber: string,
    status: string,
    truckId: string | null,
    driverId: string | null,
    extraSets: Partial<{
      acceptedBy: string;
      acceptedAt: Date;
      proposedBy: string;
      proposedAt: Date;
    }>,
  ): Promise<string> => {
    const exist = await dataSource.query(
      `SELECT id FROM shipments
       WHERE company_id = $1 AND reference_number = $2 AND deleted_at IS NULL`,
      [swiftId, refNumber],
    );
    if (exist.length > 0) return exist[0].id;

    const tracking = `SHP-DEMO-${Date.now().toString(36).toUpperCase()}-${refNumber.slice(-3)}`;
    const r = await dataSource.query(
      `INSERT INTO shipments (
        company_id, customer_company_id, tracking_code, reference_number,
        status, priority, origin_address, destination_address,
        description, cargo_type, currency,
        truck_id, driver_id,
        proposed_by, proposed_at, accepted_by, accepted_at,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4,
        $5, 'normal', $6, $7,
        $8, 'general', 'USD',
        $9, $10,
        $11, $12, $13, $14,
        NOW(), NOW()
      ) RETURNING id`,
      [
        swiftId,
        acmeId,
        tracking,
        refNumber,
        status,
        '500 Brickell Ave, Miami, FL',
        '1100 Pennsylvania Ave NW, Washington DC',
        `Carga demo cross-company (${refNumber})`,
        truckId,
        driverId,
        extraSets.proposedBy || acmeOwnerId,
        extraSets.proposedAt || new Date(),
        extraSets.acceptedBy || null,
        extraSets.acceptedAt || null,
      ],
    );
    return r[0].id;
  };

  const shipmentPending = await createShipment(
    'XCO-PENDING-001',
    'pending_acceptance',
    null,
    null,
    {},
  );
  const shipmentConfirmed = await createShipment(
    'XCO-CONFIRMED-002',
    'confirmed',
    null,
    null,
    {
      acceptedBy: swiftOwnerId,
      acceptedAt: new Date(Date.now() - 1000 * 60 * 60), // hace 1h
    },
  );
  const shipmentAssigned = await createShipment(
    'XCO-ASSIGNED-003',
    'assigned',
    truckIds['SWIFT-001'],
    driverIds['SW-DL-001'],
    {
      acceptedBy: swiftOwnerId,
      acceptedAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // hace 2h
    },
  );

  logger.log(`✓ Shipments cross-company:`);
  logger.log(`    • PENDING_ACCEPTANCE → ${shipmentPending}`);
  logger.log(`    • CONFIRMED          → ${shipmentConfirmed}`);
  logger.log(`    • ASSIGNED           → ${shipmentAssigned}`);

  logger.log('✅ Cross-company demo seed completado');
  logger.log('📋 Prueba el flujo en Swagger:');
  logger.log('    Login como swift@demo.com / Demo1234! (carrier)');
  logger.log(`    POST /v1/shipments/${shipmentPending}/accept`);
  logger.log(
    `    POST /v1/shipments/${shipmentPending}/reject  con { "reason": "..." }`,
  );
  logger.log('    Login como acme@demo.com  / Demo1234! (cliente)');
  logger.log(
    '    POST /v1/shipments  con { "customerCompanyId": "<acmeId>", "proposedCarrierId": "<swiftId>", ... }',
  );
}

// ───────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────

async function upsertCompany(name: string, type: string): Promise<string> {
  const exist = await dataSource.query(
    `SELECT id FROM companies WHERE name = $1 LIMIT 1`,
    [name],
  );
  if (exist.length > 0) return exist[0].id;
  const r = await dataSource.query(
    `INSERT INTO companies (name, type, status, created_at, updated_at)
     VALUES ($1, $2, 'active', NOW(), NOW()) RETURNING id`,
    [name, type],
  );
  return r[0].id;
}

async function upsertUserOwner(
  supabase: any,
  email: string,
  password: string,
  firstName: string,
  lastName: string,
  companyId: string,
): Promise<string> {
  // 1. Buscar local
  const localExist = await dataSource.query(
    `SELECT id, company_id FROM users WHERE email = $1 LIMIT 1`,
    [email],
  );
  if (localExist.length > 0) {
    // Asegurar que esté ligado a la company correcta
    if (localExist[0].company_id !== companyId) {
      await dataSource.query(
        `UPDATE users SET company_id = $1, role = 'company_owner' WHERE id = $2`,
        [companyId, localExist[0].id],
      );
    }
    return localExist[0].id;
  }

  // 2. Crear/encontrar en Supabase Auth
  let authUid: string | null = null;
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: firstName, last_name: lastName },
    });
    if (error) throw error;
    authUid = data.user.id;
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number; message?: string };
    if (e?.code === 'email_exists' || e?.status === 422) {
      const { data } = await supabase.auth.admin.listUsers();
      const existing = data?.users?.find(
        (u: { email?: string; id: string }) =>
          u.email?.toLowerCase() === email.toLowerCase(),
      );
      authUid = existing?.id || null;
    } else {
      throw err;
    }
  }
  if (!authUid)
    throw new Error(`No se pudo crear/encontrar auth user para ${email}`);

  // 3. Crear local
  const r = await dataSource.query(
    `INSERT INTO users (
      auth_uid, company_id, email, first_name, last_name,
      role, status, email_verified_at, created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, 'company_owner', 'active', NOW(), NOW(), NOW())
    RETURNING id`,
    [authUid, companyId, email, firstName, lastName],
  );
  return r[0].id;
}
