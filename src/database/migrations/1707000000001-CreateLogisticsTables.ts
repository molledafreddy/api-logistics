import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Crea todas las tablas del dominio de logística:
 *   - trucks
 *   - drivers
 *   - routes
 *   - shipments
 *   - tracking_points  (alta cardinalidad, GPS)
 *   - expenses
 *   - chat_conversations
 *   - chat_messages
 *
 * Los enums ya fueron creados en la migración 1700000000002-CreateEnums.
 * (truck_status_enum, driver_status_enum, shipment_status_enum, expense_status_enum)
 */
export class CreateLogisticsTables1707000000001 implements MigrationInterface {
  name = 'CreateLogisticsTables1707000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ╔══════════════════════════════════════════════════════════════╗
    // ║  TRUCKS                                                      ║
    // ╚══════════════════════════════════════════════════════════════╝
    await queryRunner.query(`
      CREATE TABLE trucks (
        id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id               UUID NOT NULL,

        plate                    VARCHAR(20) NOT NULL,
        vin                      VARCHAR(17),
        make                     VARCHAR(50),
        model                    VARCHAR(50),
        year                     INT,
        color                    VARCHAR(30),

        type                     VARCHAR(20),
        capacity_kg              NUMERIC(10,2),
        capacity_volume_m3       NUMERIC(10,2),

        status                   truck_status_enum NOT NULL DEFAULT 'available',
        current_driver_id        UUID,

        insurance_expires_at     DATE,
        registration_expires_at  DATE,
        last_maintenance_at      DATE,
        next_maintenance_at      DATE,
        odometer_km              INT,

        last_lat                 NUMERIC(10,7),
        last_lng                 NUMERIC(10,7),
        last_location_at         TIMESTAMPTZ,

        notes                    TEXT,
        metadata                 JSONB NOT NULL DEFAULT '{}',

        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at               TIMESTAMPTZ,

        CONSTRAINT fk_trucks_company FOREIGN KEY (company_id)
          REFERENCES companies(id) ON DELETE CASCADE
      );

      CREATE INDEX idx_trucks_company ON trucks(company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_trucks_company_status ON trucks(company_id, status) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_trucks_company_plate ON trucks(company_id, plate) WHERE deleted_at IS NULL;
      CREATE INDEX idx_trucks_current_driver ON trucks(current_driver_id) WHERE deleted_at IS NULL;
    `);

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  DRIVERS                                                     ║
    // ╚══════════════════════════════════════════════════════════════╝
    await queryRunner.query(`
      CREATE TABLE drivers (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id          UUID NOT NULL,
        user_id             UUID,

        first_name          VARCHAR(100) NOT NULL,
        last_name           VARCHAR(100) NOT NULL,
        email               VARCHAR(255),
        phone               VARCHAR(30),
        birth_date          DATE,

        license_number      VARCHAR(50) NOT NULL,
        license_class       VARCHAR(20),
        license_state       VARCHAR(50),
        license_expires_at  DATE,

        status              driver_status_enum NOT NULL DEFAULT 'available',
        rating_avg          NUMERIC(3,2) NOT NULL DEFAULT 0,
        total_trips         INT NOT NULL DEFAULT 0,

        current_truck_id    UUID,

        address_line1       VARCHAR(255),
        city                VARCHAR(100),
        state               VARCHAR(100),
        zip_code            VARCHAR(20),
        country             VARCHAR(3) NOT NULL DEFAULT 'US',

        notes               TEXT,
        metadata            JSONB NOT NULL DEFAULT '{}',

        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMPTZ,

        CONSTRAINT fk_drivers_company FOREIGN KEY (company_id)
          REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_drivers_user FOREIGN KEY (user_id)
          REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_drivers_current_truck FOREIGN KEY (current_truck_id)
          REFERENCES trucks(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_drivers_company ON drivers(company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_drivers_company_status ON drivers(company_id, status) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_drivers_company_license ON drivers(company_id, license_number) WHERE deleted_at IS NULL;
      CREATE INDEX idx_drivers_user ON drivers(user_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_drivers_current_truck ON drivers(current_truck_id) WHERE deleted_at IS NULL;
    `);

    // FK circular trucks.current_driver_id → drivers.id (se agrega después de crear drivers)
    await queryRunner.query(`
      ALTER TABLE trucks
        ADD CONSTRAINT fk_trucks_current_driver FOREIGN KEY (current_driver_id)
          REFERENCES drivers(id) ON DELETE SET NULL;
    `);

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  ROUTES                                                      ║
    // ╚══════════════════════════════════════════════════════════════╝
    await queryRunner.query(`
      CREATE TABLE routes (
        id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id               UUID NOT NULL,

        name                     VARCHAR(150) NOT NULL,
        description              TEXT,
        status                   VARCHAR(20) NOT NULL DEFAULT 'draft',

        origin_address           VARCHAR(255) NOT NULL,
        origin_lat               NUMERIC(10,7) NOT NULL,
        origin_lng               NUMERIC(10,7) NOT NULL,

        destination_address      VARCHAR(255) NOT NULL,
        destination_lat          NUMERIC(10,7) NOT NULL,
        destination_lng          NUMERIC(10,7) NOT NULL,

        distance_km              NUMERIC(10,2),
        estimated_duration_min   INT,
        base_price               NUMERIC(12,2),
        currency                 VARCHAR(3) NOT NULL DEFAULT 'USD',

        waypoints                JSONB NOT NULL DEFAULT '[]',
        polyline_encoded         TEXT,
        metadata                 JSONB NOT NULL DEFAULT '{}',

        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at               TIMESTAMPTZ,

        CONSTRAINT fk_routes_company FOREIGN KEY (company_id)
          REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT chk_routes_status CHECK (status IN ('draft', 'active', 'archived'))
      );

      CREATE INDEX idx_routes_company ON routes(company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_routes_company_status ON routes(company_id, status) WHERE deleted_at IS NULL;
    `);

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  SHIPMENTS                                                   ║
    // ╚══════════════════════════════════════════════════════════════╝
    await queryRunner.query(`
      CREATE TABLE shipments (
        id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id                  UUID NOT NULL,
        customer_company_id         UUID,

        tracking_code               VARCHAR(50) NOT NULL,
        reference_number            VARCHAR(100),
        status                      shipment_status_enum NOT NULL DEFAULT 'draft',
        priority                    VARCHAR(20) NOT NULL DEFAULT 'normal',

        route_id                    UUID,
        truck_id                    UUID,
        driver_id                   UUID,

        origin_address              VARCHAR(255) NOT NULL,
        origin_lat                  NUMERIC(10,7),
        origin_lng                  NUMERIC(10,7),
        origin_contact_name         VARCHAR(100),
        origin_contact_phone        VARCHAR(30),

        destination_address         VARCHAR(255) NOT NULL,
        destination_lat             NUMERIC(10,7),
        destination_lng             NUMERIC(10,7),
        destination_contact_name    VARCHAR(100),
        destination_contact_phone   VARCHAR(30),

        description                 VARCHAR(255) NOT NULL,
        weight_kg                   NUMERIC(10,2),
        volume_m3                   NUMERIC(10,2),
        pieces                      INT,
        cargo_type                  VARCHAR(30) NOT NULL DEFAULT 'general',

        pickup_at                   TIMESTAMPTZ,
        delivery_at                 TIMESTAMPTZ,
        picked_up_at                TIMESTAMPTZ,
        delivered_at                TIMESTAMPTZ,

        price                       NUMERIC(12,2),
        currency                    VARCHAR(3) NOT NULL DEFAULT 'USD',

        pod_url                     VARCHAR(500),
        pod_signed_by               VARCHAR(100),
        pod_uploaded_at             TIMESTAMPTZ,

        cancel_reason               TEXT,
        cancelled_at                TIMESTAMPTZ,

        notes                       TEXT,
        metadata                    JSONB NOT NULL DEFAULT '{}',

        created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at                  TIMESTAMPTZ,

        CONSTRAINT fk_shipments_company FOREIGN KEY (company_id)
          REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_shipments_customer_company FOREIGN KEY (customer_company_id)
          REFERENCES companies(id) ON DELETE SET NULL,
        CONSTRAINT fk_shipments_route FOREIGN KEY (route_id)
          REFERENCES routes(id) ON DELETE SET NULL,
        CONSTRAINT fk_shipments_truck FOREIGN KEY (truck_id)
          REFERENCES trucks(id) ON DELETE SET NULL,
        CONSTRAINT fk_shipments_driver FOREIGN KEY (driver_id)
          REFERENCES drivers(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_shipments_company ON shipments(company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_shipments_company_status ON shipments(company_id, status) WHERE deleted_at IS NULL;
      CREATE UNIQUE INDEX uq_shipments_company_tracking_code ON shipments(company_id, tracking_code) WHERE deleted_at IS NULL;
      CREATE INDEX idx_shipments_customer_company ON shipments(customer_company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_shipments_truck ON shipments(truck_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_shipments_driver ON shipments(driver_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_shipments_route ON shipments(route_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_shipments_pickup_at ON shipments(pickup_at) WHERE deleted_at IS NULL;
      CREATE INDEX idx_shipments_delivered_at ON shipments(delivered_at) WHERE deleted_at IS NULL;
    `);

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  TRACKING_POINTS  (alta cardinalidad - GPS)                  ║
    // ╚══════════════════════════════════════════════════════════════╝
    await queryRunner.query(`
      CREATE TABLE tracking_points (
        id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id    UUID NOT NULL,

        shipment_id   UUID,
        truck_id      UUID,
        driver_id     UUID,

        lat           NUMERIC(10,7) NOT NULL,
        lng           NUMERIC(10,7) NOT NULL,
        speed         NUMERIC(6,2),
        heading       NUMERIC(6,2),
        altitude      NUMERIC(8,2),
        accuracy      NUMERIC(6,2),

        event         VARCHAR(30),
        metadata      JSONB NOT NULL DEFAULT '{}',

        captured_at   TIMESTAMPTZ NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        CONSTRAINT fk_tracking_company FOREIGN KEY (company_id)
          REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_tracking_shipment FOREIGN KEY (shipment_id)
          REFERENCES shipments(id) ON DELETE CASCADE,
        CONSTRAINT fk_tracking_truck FOREIGN KEY (truck_id)
          REFERENCES trucks(id) ON DELETE SET NULL,
        CONSTRAINT fk_tracking_driver FOREIGN KEY (driver_id)
          REFERENCES drivers(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_tracking_company ON tracking_points(company_id);
      CREATE INDEX idx_tracking_shipment_captured ON tracking_points(shipment_id, captured_at DESC);
      CREATE INDEX idx_tracking_truck_captured ON tracking_points(truck_id, captured_at DESC);
      -- BRIN para escaneos por rango de tiempo (eficiente en alta cardinalidad)
      CREATE INDEX idx_tracking_captured_brin ON tracking_points USING BRIN (captured_at);
    `);

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  EXPENSES                                                    ║
    // ╚══════════════════════════════════════════════════════════════╝
    await queryRunner.query(`
      CREATE TABLE expenses (
        id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id          UUID NOT NULL,
        created_by          UUID NOT NULL,

        shipment_id         UUID,
        truck_id            UUID,
        driver_id           UUID,

        category            VARCHAR(30) NOT NULL,
        description         VARCHAR(255) NOT NULL,
        amount              NUMERIC(12,2) NOT NULL,
        currency            VARCHAR(3) NOT NULL DEFAULT 'USD',
        expense_date        DATE NOT NULL,

        status              expense_status_enum NOT NULL DEFAULT 'pending',
        approved_by         UUID,
        approved_at         TIMESTAMPTZ,
        rejection_reason    TEXT,
        reimbursed_at       TIMESTAMPTZ,

        receipt_url         VARCHAR(500),
        vendor_name         VARCHAR(100),
        payment_method      VARCHAR(100),
        notes               TEXT,
        metadata            JSONB NOT NULL DEFAULT '{}',

        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMPTZ,

        CONSTRAINT fk_expenses_company FOREIGN KEY (company_id)
          REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_expenses_created_by FOREIGN KEY (created_by)
          REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_expenses_approved_by FOREIGN KEY (approved_by)
          REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_expenses_shipment FOREIGN KEY (shipment_id)
          REFERENCES shipments(id) ON DELETE SET NULL,
        CONSTRAINT fk_expenses_truck FOREIGN KEY (truck_id)
          REFERENCES trucks(id) ON DELETE SET NULL,
        CONSTRAINT fk_expenses_driver FOREIGN KEY (driver_id)
          REFERENCES drivers(id) ON DELETE SET NULL
      );

      CREATE INDEX idx_expenses_company ON expenses(company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_expenses_company_status ON expenses(company_id, status) WHERE deleted_at IS NULL;
      CREATE INDEX idx_expenses_company_date ON expenses(company_id, expense_date DESC) WHERE deleted_at IS NULL;
      CREATE INDEX idx_expenses_created_by ON expenses(created_by) WHERE deleted_at IS NULL;
      CREATE INDEX idx_expenses_shipment ON expenses(shipment_id) WHERE deleted_at IS NULL;
    `);

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  CHAT_CONVERSATIONS                                          ║
    // ╚══════════════════════════════════════════════════════════════╝
    await queryRunner.query(`
      CREATE TABLE chat_conversations (
        id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        company_id             UUID NOT NULL,

        type                   VARCHAR(20) NOT NULL DEFAULT 'direct',
        title                  VARCHAR(150),
        shipment_id            UUID,
        participant_ids        JSONB NOT NULL DEFAULT '[]',
        created_by             UUID NOT NULL,

        last_message_at        TIMESTAMPTZ,
        last_message_preview   TEXT,

        created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at             TIMESTAMPTZ,

        CONSTRAINT fk_conversations_company FOREIGN KEY (company_id)
          REFERENCES companies(id) ON DELETE CASCADE,
        CONSTRAINT fk_conversations_created_by FOREIGN KEY (created_by)
          REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT fk_conversations_shipment FOREIGN KEY (shipment_id)
          REFERENCES shipments(id) ON DELETE SET NULL,
        CONSTRAINT chk_conversations_type CHECK (type IN ('direct', 'group', 'shipment'))
      );

      CREATE INDEX idx_conversations_company ON chat_conversations(company_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_conversations_company_updated ON chat_conversations(company_id, updated_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX idx_conversations_shipment ON chat_conversations(shipment_id) WHERE deleted_at IS NULL;
      -- GIN para búsquedas por participantes (jsonb @> operator)
      CREATE INDEX idx_conversations_participants ON chat_conversations USING GIN (participant_ids jsonb_path_ops);
    `);

    // ╔══════════════════════════════════════════════════════════════╗
    // ║  CHAT_MESSAGES                                               ║
    // ╚══════════════════════════════════════════════════════════════╝
    await queryRunner.query(`
      CREATE TABLE chat_messages (
        id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        conversation_id   UUID NOT NULL,
        sender_id         UUID NOT NULL,

        type              VARCHAR(20) NOT NULL DEFAULT 'text',
        content           TEXT NOT NULL,

        file_url          VARCHAR(500),
        file_name         VARCHAR(100),

        read_by           JSONB NOT NULL DEFAULT '[]',
        metadata          JSONB NOT NULL DEFAULT '{}',

        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at        TIMESTAMPTZ,

        CONSTRAINT fk_messages_conversation FOREIGN KEY (conversation_id)
          REFERENCES chat_conversations(id) ON DELETE CASCADE,
        CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id)
          REFERENCES users(id) ON DELETE RESTRICT,
        CONSTRAINT chk_messages_type CHECK (type IN ('text', 'image', 'file', 'system'))
      );

      CREATE INDEX idx_messages_conversation ON chat_messages(conversation_id) WHERE deleted_at IS NULL;
      CREATE INDEX idx_messages_conversation_created ON chat_messages(conversation_id, created_at DESC) WHERE deleted_at IS NULL;
      CREATE INDEX idx_messages_sender ON chat_messages(sender_id) WHERE deleted_at IS NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Orden inverso: primero los que tienen FKs hacia los demás
    await queryRunner.query(`DROP TABLE IF EXISTS chat_messages`);
    await queryRunner.query(`DROP TABLE IF EXISTS chat_conversations`);
    await queryRunner.query(`DROP TABLE IF EXISTS expenses`);
    await queryRunner.query(`DROP TABLE IF EXISTS tracking_points`);
    await queryRunner.query(`DROP TABLE IF EXISTS shipments`);
    await queryRunner.query(`DROP TABLE IF EXISTS routes`);
    // Quitar FK circular antes de drop
    await queryRunner.query(
      `ALTER TABLE trucks DROP CONSTRAINT IF EXISTS fk_trucks_current_driver`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS drivers`);
    await queryRunner.query(`DROP TABLE IF EXISTS trucks`);
  }
}
