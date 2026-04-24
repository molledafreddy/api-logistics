import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../modules/companies/entities/company.entity';
import { BUSINESS_MODEL_KEY } from '../decorators/require-business-model.decorator';
import { BusinessModel } from '../enums/business-model.enum';
import { UserRole } from '../enums/user-role.enum';
import { IUserPayload } from '../interfaces/user-payload.interface';

/**
 * Valida que la `Company` del usuario autenticado tenga uno de los `BusinessModel`
 * requeridos por el decorador `@RequireBusinessModel(...)`.
 *
 * Reglas:
 * - `super_admin` siempre pasa.
 * - Sin decorador → permite acceso.
 * - Cachea la consulta por request a través de `request.__companyBusinessModel`.
 */
@Injectable()
export class BusinessModelGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<BusinessModel[]>(
      BUSINESS_MODEL_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user as IUserPayload | undefined;

    if (!user) {
      throw new ForbiddenException('Acceso denegado');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    if (!user.companyId) {
      throw new ForbiddenException('No perteneces a ninguna empresa');
    }

    let businessModel: BusinessModel | undefined =
      request.__companyBusinessModel;
    if (!businessModel) {
      const company = await this.companyRepo.findOne({
        where: { id: user.companyId },
        select: ['id', 'businessModel'],
      });
      if (!company) {
        throw new ForbiddenException('Empresa no encontrada');
      }
      businessModel = company.businessModel;
      request.__companyBusinessModel = businessModel;
    }

    if (!required.includes(businessModel)) {
      throw new ForbiddenException(
        `Este endpoint requiere businessModel=[${required.join(', ')}], tu empresa es '${businessModel}'`,
      );
    }

    return true;
  }
}
