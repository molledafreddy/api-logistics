import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { IUserPayload } from '../interfaces/user-payload.interface';
import { UserRole } from '../enums/user-role.enum';

/**
 * Company Ownership Guard
 * Verifies the authenticated user belongs to the company referenced in the request.
 *
 * Checks for companyId in this order:
 *   1. Route param :companyId
 *   2. Request body { companyId }
 *   3. The user's own companyId (for scoped resources like /users within the same company)
 *
 * super_admin always passes.
 * Use with @UseGuards(CompanyOwnershipGuard) on controllers/routes that are company-scoped.
 */
@Injectable()
export class CompanyOwnershipGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as IUserPayload | undefined;

    if (!user) {
      return true; // Let JwtAuthGuard handle missing user
    }

    // super_admin bypasses company check
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    // Determine the target company ID
    const targetCompanyId =
      request.params.companyId || request.body?.companyId || null;

    // If there's no target companyId in the request, skip this guard
    // (the resource may be implicitly scoped to user.companyId in the service)
    if (!targetCompanyId) {
      return true;
    }

    // User must belong to the target company
    if (!user.companyId) {
      throw new ForbiddenException('No perteneces a ninguna empresa');
    }

    if (user.companyId !== targetCompanyId) {
      throw new ForbiddenException('No tienes acceso a esta empresa');
    }

    return true;
  }
}
