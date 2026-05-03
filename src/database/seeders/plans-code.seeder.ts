import { DataSource } from 'typeorm';

export async function seedPlansCode(dataSource: DataSource): Promise<void> {
  // Asigna códigos únicos a los planes legacy si no tienen code
  await dataSource.query(`
    UPDATE plans
      SET code = LOWER(name) || '_legacy'
    WHERE code IS NULL AND name IS NOT NULL
  `);
  console.log('✅ Seed de codes en plans ejecutado');
}
