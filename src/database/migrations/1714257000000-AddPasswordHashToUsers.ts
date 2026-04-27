import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPasswordHashToUsers1714257000000 implements MigrationInterface {
  name = 'AddPasswordHashToUsers1714257000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'password_hash',
        type: 'varchar',
        length: '255',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('users', 'password_hash');
  }
}
