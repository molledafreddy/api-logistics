import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * PARTE 7 — Sprint 6 · Compliance Passenger
 *
 * Inserta el tier `passenger_safe` requerido para operar `serviceType=passenger`
 * (MV-002). Idempotente: usa ON CONFLICT (code) DO NOTHING.
 *
 * Documentos requeridos para este tier:
 *  - background_check       → Background check del operador y cada chofer
 *  - school_insurance       → Seguro de transporte escolar / pasajeros
 *  - monitor_license        → Licencia/certificación de monitor a bordo
 *  - vehicle_safety_inspect → Inspección de seguridad anual de cada vehículo
 *  - driver_first_aid       → Certificado de primeros auxilios del chofer
 */
export class SeedPassengerSafeTier1708000000004 implements MigrationInterface {
  name = 'SeedPassengerSafeTier1708000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO verification_tiers (
        id, code, name, description, price, currency, validity_days,
        required_documents, requirements, display_order, badge_color, badge_icon, is_active,
        created_at, updated_at
      )
      VALUES (
        uuid_generate_v4(),
        'passenger_safe',
        'Passenger Safe',
        'Tier obligatorio para empresas con serviceType=passenger. Habilita el ' ||
          'transporte de personas (escolar, médico, ride-sharing) y desbloquea la ' ||
          'creación de DeliveryRuns con cargoType=passenger.',
        199.00,
        'USD',
        365,
        '["background_check","school_insurance","monitor_license","vehicle_safety_inspect","driver_first_aid"]'::jsonb,
        '{"minDriversBackgroundChecked":1,"requiresAnnualInspection":true,"requiresFirstAidCertified":true}'::jsonb,
        50,
        '#FFB300',
        'shield-check',
        TRUE,
        NOW(),
        NOW()
      )
      ON CONFLICT (code) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DELETE FROM verification_tiers WHERE code = 'passenger_safe'
    `);
  }
}
