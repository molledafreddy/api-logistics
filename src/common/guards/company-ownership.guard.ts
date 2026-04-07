import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * Company Ownership Guard — Stub for Fase 0
 * Full implementation in Fase 1
 * Verifies the user belongs to the company they're trying to access
 */
@Injectable()
export class CompanyOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const companyId = request.params.companyId || request.body?.companyId;

    if (!user || !companyId) {
      return true; // Let other guards handle auth
    }

    if (user.role === 'super_admin') {
      return true;
    }

    if (user.companyId !== companyId) {
      throw new ForbiddenException('You do not have access to this company');
    }

    return true;
  }
}
