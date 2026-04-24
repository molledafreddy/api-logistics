import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Company } from '../modules/companies/entities/company.entity';
import { ServiceTypeGuard } from './guards/service-type.guard';
import { BusinessModelGuard } from './guards/business-model.guard';

/**
 * CommonModule — Global
 *
 * Expone guards y utilidades compartidas que dependen de TypeORM (p.ej. los
 * guards multi-vertical que leen `Company.serviceType` / `Company.businessModel`).
 *
 * Se marca `@Global()` para que los guards estén disponibles en cualquier
 * controlador vía `@UseGuards(ServiceTypeGuard)` sin tener que importar este
 * módulo manualmente en cada feature module.
 */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Company])],
  providers: [ServiceTypeGuard, BusinessModelGuard],
  exports: [ServiceTypeGuard, BusinessModelGuard],
})
export class CommonModule {}
