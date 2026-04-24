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
import { SERVICE_TYPE_KEY } from '../decorators/require-service-type.decorator';
import { ServiceType } from '../enums/service-type.enum';
import { UserRole } from '../enums/user-role.enum';
import { IUserPayload } from '../interfaces/user-payload.interface';

/**
 * Valida que la `Company` del usuario autenticado tenga uno de los `ServiceType`
 * requeridos por el decorador `@RequireServiceType(...)`.
 *
 * Reglas:
 * - `super_admin` siempre pasa.
 * - Sin decorador → permite acceso.
 * - Si `Company.serviceType === MIXED` → pasa para cualquier tipo requerido.
 * - Cachea la consulta por request a través de `request.__companyServiceType`.
 */
@Injectable()
export class ServiceTypeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Company)
    private readonly companyRepo: Repository<Company>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<ServiceType[]>(
      SERVICE_TYPE_KEY,
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

    // Caché por request para no golpear DB múltiples veces en la misma petición
    let serviceType: ServiceType | undefined = request.__companyServiceType;
    if (!serviceType) {
      const company = await this.companyRepo.findOne({
        where: { id: user.companyId },
        select: ['id', 'serviceType'],
      });
      if (!company) {
        throw new ForbiddenException('Empresa no encontrada');
      }
      serviceType = company.serviceType;
      request.__companyServiceType = serviceType;
    }

    // MIXED pasa para cualquier tipo
    if (serviceType === ServiceType.MIXED) {
      return true;
    }

    if (!required.includes(serviceType)) {
      throw new ForbiddenException(
        `Este endpoint requiere serviceType=[${required.join(', ')}], tu empresa es '${serviceType}'`,
      );
    }

    return true;
  }
}
