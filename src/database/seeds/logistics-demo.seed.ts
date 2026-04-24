import { Logger } from '@nestjs/common';
import dataSource from '../data-source';

const logger = new Logger('LogisticsDemoSeed');

/**
 * Seed de datos demo para los módulos de logística.
 * Solo se ejecuta cuando SEED_DEMO=true.
 *
 * Crea para la "Test Company":
 *   - 5 trucks
 *   - 5 drivers
 *   - 3 routes
 *   - 6 shipments en distintos status
 *   - 4 expenses
 *
 * Es idempotente: usa upserts/checks por nombre/plate/license.
 */
export async function seedLogisticsDemo() {
  if (process.env.SEED_DEMO !== 'true') {
    logger.log('SEED_DEMO no está activo, se omite seeder de logística demo');
    return;
  }

  if (!dataSource.isInitialized) await dataSource.initialize();

  // ─── Resolver la Test Company y un usuario para ownership ───
  const company = await dataSource.query(
    `SELECT id FROM companies WHERE name = $1 LIMIT 1`,
    ['Test Company'],
  );
  if (company.length === 0) {
    logger.warn('Test Company no existe. Ejecuta primero el seed base.');
    return;
  }
  const companyId = company[0].id;

  const user = await dataSource.query(
    `SELECT id FROM users WHERE company_id = $1 LIMIT 1`,
    [companyId],
  );
  if (user.length === 0) {
    logger.warn(
      'No hay usuarios para Test Company. Ejecuta primero el seed base.',
    );
    return;
  }
  const userId = user[0].id;

  logger.log(`Sembrando datos demo para companyId=${companyId}`);

  // ─── TRUCKS ─────────────────────────────
  const trucks = [
    {
      plate: 'DEMO-001',
      make: 'Volvo',
      model: 'VNL 760',
      year: 2022,
      type: 'dry-van',
      capacity_kg: 18000,
      status: 'available',
    },
    {
      plate: 'DEMO-002',
      make: 'Freightliner',
      model: 'Cascadia',
      year: 2021,
      type: 'reefer',
      capacity_kg: 16000,
      status: 'available',
    },
    {
      plate: 'DEMO-003',
      make: 'Kenworth',
      model: 'T680',
      year: 2023,
      type: 'flatbed',
      capacity_kg: 20000,
      status: 'in_transit',
    },
    {
      plate: 'DEMO-004',
      make: 'Peterbilt',
      model: '579',
      year: 2020,
      type: 'tanker',
      capacity_kg: 22000,
      status: 'maintenance',
    },
    {
      plate: 'DEMO-005',
      make: 'Mack',
      model: 'Anthem',
      year: 2022,
      type: 'box',
      capacity_kg: 12000,
      status: 'available',
    },
  ];

  const truckIds: Record<string, string> = {};
  for (const t of trucks) {
    const existing = await dataSource.query(
      `SELECT id FROM trucks WHERE company_id = $1 AND plate = $2 AND deleted_at IS NULL`,
      [companyId, t.plate],
    );
    if (existing.length > 0) {
      truckIds[t.plate] = existing[0].id;
      continue;
    }
    const inserted = await dataSource.query(
      `INSERT INTO trucks (company_id, plate, make, model, year, type, capacity_kg, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),NOW()) RETURNING id`,
      [
        companyId,
        t.plate,
        t.make,
        t.model,
        t.year,
        t.type,
        t.capacity_kg,
        t.status,
      ],
    );
    truckIds[t.plate] = inserted[0].id;
  }
  logger.log(`✓ ${Object.keys(truckIds).length} trucks listos`);

  // ─── DRIVERS ────────────────────────────
  const drivers = [
    {
      license: 'DL-DEMO-001',
      first: 'John',
      last: 'Smith',
      status: 'available',
    },
    {
      license: 'DL-DEMO-002',
      first: 'Maria',
      last: 'Garcia',
      status: 'available',
    },
    {
      license: 'DL-DEMO-003',
      first: 'David',
      last: 'Brown',
      status: 'on_trip',
    },
    {
      license: 'DL-DEMO-004',
      first: 'Sarah',
      last: 'Johnson',
      status: 'off_duty',
    },
    {
      license: 'DL-DEMO-005',
      first: 'Michael',
      last: 'Lee',
      status: 'available',
    },
  ];

  const driverIds: Record<string, string> = {};
  for (const d of drivers) {
    const existing = await dataSource.query(
      `SELECT id FROM drivers WHERE company_id = $1 AND license_number = $2 AND deleted_at IS NULL`,
      [companyId, d.license],
    );
    if (existing.length > 0) {
      driverIds[d.license] = existing[0].id;
      continue;
    }
    const inserted = await dataSource.query(
      `INSERT INTO drivers (company_id, first_name, last_name, license_number, license_class, status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW()) RETURNING id`,
      [companyId, d.first, d.last, d.license, 'CDL-A', d.status],
    );
    driverIds[d.license] = inserted[0].id;
  }
  logger.log(`✓ ${Object.keys(driverIds).length} drivers listos`);

  // Asignar driver al truck "DEMO-003" (in_transit)
  await dataSource.query(
    `UPDATE trucks SET current_driver_id = $1 WHERE id = $2 AND current_driver_id IS NULL`,
    [driverIds['DL-DEMO-003'], truckIds['DEMO-003']],
  );
  await dataSource.query(
    `UPDATE drivers SET current_truck_id = $1 WHERE id = $2 AND current_truck_id IS NULL`,
    [truckIds['DEMO-003'], driverIds['DL-DEMO-003']],
  );

  // ─── ROUTES ─────────────────────────────
  const routes = [
    {
      name: 'Miami → Atlanta',
      origin: 'Miami, FL',
      oLat: 25.7617,
      oLng: -80.1918,
      dest: 'Atlanta, GA',
      dLat: 33.749,
      dLng: -84.388,
      distance: 1050.5,
      duration: 660,
      price: 1800,
    },
    {
      name: 'Houston → Dallas',
      origin: 'Houston, TX',
      oLat: 29.7604,
      oLng: -95.3698,
      dest: 'Dallas, TX',
      dLat: 32.7767,
      dLng: -96.797,
      distance: 385.0,
      duration: 240,
      price: 700,
    },
    {
      name: 'Los Angeles → Phoenix',
      origin: 'Los Angeles, CA',
      oLat: 34.0522,
      oLng: -118.2437,
      dest: 'Phoenix, AZ',
      dLat: 33.4484,
      dLng: -112.074,
      distance: 600.3,
      duration: 360,
      price: 1100,
    },
  ];

  const routeIds: Record<string, string> = {};
  for (const r of routes) {
    const existing = await dataSource.query(
      `SELECT id FROM routes WHERE company_id = $1 AND name = $2 AND deleted_at IS NULL`,
      [companyId, r.name],
    );
    if (existing.length > 0) {
      routeIds[r.name] = existing[0].id;
      continue;
    }
    const inserted = await dataSource.query(
      `INSERT INTO routes (company_id, name, status, origin_address, origin_lat, origin_lng,
                           destination_address, destination_lat, destination_lng,
                           distance_km, estimated_duration_min, base_price, created_at, updated_at)
       VALUES ($1,$2,'active',$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW(),NOW()) RETURNING id`,
      [
        companyId,
        r.name,
        r.origin,
        r.oLat,
        r.oLng,
        r.dest,
        r.dLat,
        r.dLng,
        r.distance,
        r.duration,
        r.price,
      ],
    );
    routeIds[r.name] = inserted[0].id;
  }
  logger.log(`✓ ${Object.keys(routeIds).length} routes listos`);

  // ─── SHIPMENTS ──────────────────────────
  const ts = Date.now().toString(36);
  const shipments = [
    {
      code: `SHP-DEMO-${ts}-001`,
      status: 'completed',
      price: 1800,
      route: 'Miami → Atlanta',
      truck: 'DEMO-001',
      driver: 'DL-DEMO-001',
      pickedUp: true,
      delivered: true,
    },
    {
      code: `SHP-DEMO-${ts}-002`,
      status: 'in_transit',
      price: 700,
      route: 'Houston → Dallas',
      truck: 'DEMO-003',
      driver: 'DL-DEMO-003',
      pickedUp: true,
      delivered: false,
    },
    {
      code: `SHP-DEMO-${ts}-003`,
      status: 'assigned',
      price: 1100,
      route: 'Los Angeles → Phoenix',
      truck: 'DEMO-002',
      driver: 'DL-DEMO-002',
      pickedUp: false,
      delivered: false,
    },
    {
      code: `SHP-DEMO-${ts}-004`,
      status: 'confirmed',
      price: 1800,
      route: 'Miami → Atlanta',
    },
    {
      code: `SHP-DEMO-${ts}-005`,
      status: 'draft',
      price: 700,
      route: 'Houston → Dallas',
    },
    {
      code: `SHP-DEMO-${ts}-006`,
      status: 'cancelled',
      price: 1100,
      route: 'Los Angeles → Phoenix',
    },
  ];

  let shipmentsCreated = 0;
  const firstShipmentId: { id?: string } = {};
  for (const s of shipments) {
    const route = routes.find((r) => r.name === s.route)!;
    const inserted = await dataSource.query(
      `INSERT INTO shipments (
         company_id, tracking_code, status, priority,
         route_id, truck_id, driver_id,
         origin_address, origin_lat, origin_lng,
         destination_address, destination_lat, destination_lng,
         description, weight_kg, cargo_type,
         picked_up_at, delivered_at,
         price, currency,
         created_at, updated_at
       ) VALUES ($1,$2,$3,'normal',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'general',$15,$16,$17,'USD',NOW(),NOW())
       RETURNING id`,
      [
        companyId,
        s.code,
        s.status,
        routeIds[s.route] || null,
        s.truck ? truckIds[s.truck] : null,
        s.driver ? driverIds[s.driver] : null,
        route.origin,
        route.oLat,
        route.oLng,
        route.dest,
        route.dLat,
        route.dLng,
        `Demo cargo for ${s.route}`,
        5000,
        s.pickedUp ? new Date(Date.now() - 3 * 24 * 3600 * 1000) : null,
        s.delivered ? new Date(Date.now() - 1 * 24 * 3600 * 1000) : null,
        s.price,
      ],
    );
    if (!firstShipmentId.id) firstShipmentId.id = inserted[0].id;
    shipmentsCreated++;
  }
  logger.log(`✓ ${shipmentsCreated} shipments creados`);

  // ─── EXPENSES ───────────────────────────
  const expenses = [
    {
      category: 'fuel',
      description: 'Diesel refill - Miami terminal',
      amount: 350.5,
      status: 'approved',
    },
    {
      category: 'toll',
      description: 'Florida Turnpike toll',
      amount: 42.75,
      status: 'pending',
    },
    {
      category: 'maintenance',
      description: 'Oil change DEMO-004',
      amount: 180.0,
      status: 'reimbursed',
    },
    {
      category: 'meal',
      description: 'Driver meal allowance',
      amount: 25.0,
      status: 'pending',
    },
  ];

  let expensesCreated = 0;
  for (const e of expenses) {
    await dataSource.query(
      `INSERT INTO expenses (
         company_id, created_by, category, description, amount, currency, expense_date, status, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,'USD',CURRENT_DATE,$6,NOW(),NOW())`,
      [companyId, userId, e.category, e.description, e.amount, e.status],
    );
    expensesCreated++;
  }
  logger.log(`✓ ${expensesCreated} expenses creados`);

  logger.log('🎉 Logistics demo data sembrada exitosamente');
}
