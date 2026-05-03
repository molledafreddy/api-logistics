import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Sprint C — Geocoding utility + direcciones embebidas (Modelo C).
 *
 * Las columnas `origin_lat`, `origin_lng`, `destination_lat`, `destination_lng`
 * ya existen en `shipments` desde el sprint logístico inicial. Esta migración
 * agrega los metadatos faltantes para soportar Modelo C:
 *
 *   - `*_place_id`    : identificador estable del provider de geocoding
 *                       (ej. Mapbox `place.id` "address.123456789").
 *   - `*_confidence`  : score 0..1 reportado por el provider para el match.
 *                       Permite a la UI marcar direcciones de baja calidad.
 *
 * Diseño:
 *   - Aditiva, todas las columnas son NULLables → 100% retro-compatible.
 *   - `IF NOT EXISTS` para idempotencia.
 *   - El `down()` borra solo las 4 columnas nuevas.
 */
export class AddCoordsToShipments1710000000001 implements MigrationInterface {
  name = 'AddCoordsToShipments1710000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE shipments
        ADD COLUMN IF NOT EXISTS origin_place_id varchar(200),
        ADD COLUMN IF NOT EXISTS origin_confidence numeric(3,2),
        ADD COLUMN IF NOT EXISTS destination_place_id varchar(200),
        ADD COLUMN IF NOT EXISTS destination_confidence numeric(3,2);
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN shipments.origin_place_id IS
        'Sprint C — Geocoding: ID estable del provider (Mapbox/etc) para la dirección de origen.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN shipments.origin_confidence IS
        'Sprint C — Geocoding: score de confianza 0..1 del match para la dirección de origen.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN shipments.destination_place_id IS
        'Sprint C — Geocoding: ID estable del provider (Mapbox/etc) para la dirección de destino.';
    `);
    await queryRunner.query(`
      COMMENT ON COLUMN shipments.destination_confidence IS
        'Sprint C — Geocoding: score de confianza 0..1 del match para la dirección de destino.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE shipments
        DROP COLUMN IF EXISTS origin_place_id,
        DROP COLUMN IF EXISTS origin_confidence,
        DROP COLUMN IF EXISTS destination_place_id,
        DROP COLUMN IF EXISTS destination_confidence;
    `);
  }
}
