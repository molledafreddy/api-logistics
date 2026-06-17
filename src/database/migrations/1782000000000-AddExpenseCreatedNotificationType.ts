import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExpenseCreatedNotificationType1782000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ALTER TYPE ... ADD VALUE no puede correr dentro de una transacción
    // en versiones anteriores de PostgreSQL. Se usa COMMIT/BEGIN para salir
    // del bloque transaccional de TypeORM y volver a entrar.
    await queryRunner.query('COMMIT');
    await queryRunner.query(
      `ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'expense_created'`,
    );
    await queryRunner.query('BEGIN');
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL no permite eliminar valores de un enum sin recrearlo.
    // La migración de rollback es no-op intencionalmente.
  }
}
