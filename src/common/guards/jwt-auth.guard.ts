import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { DataSource } from 'typeorm';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT Auth Guard — Validates Supabase JWT tokens via Passport
 * Routes decorated with @Public() bypass authentication.
 * In E2E test mode (E2E_TEST=true), validates directly against Supabase API
 * to avoid jwks-rsa hanging issues.
 */
@Injectable()
export class JwtAuthGuard
  extends AuthGuard('supabase-jwt')
  implements CanActivate
{
  constructor(
    private reflector: Reflector,
    @Optional() @Inject(DataSource) private dataSource?: DataSource,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    // In E2E test mode, bypass Passport/JWKS and validate directly with Supabase
    if (process.env.E2E_TEST === 'true') {
      return this.validateDirectly(context);
    }

    try {
      const result = await super.canActivate(context);
      return result as boolean;
    } catch (err) {
      throw err;
    }
  }

  /**
   * Direct validation against Supabase /auth/v1/user endpoint.
   * Used in E2E tests to avoid jwks-rsa hanging.
   */
  private async validateDirectly(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');
    const supabaseUrl = process.env.SUPABASE_URL;
    const apikey =
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !apikey) {
      throw new UnauthorizedException('Supabase env vars not configured');
    }

    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        apikey: String(apikey),
      },
    });

    if (!response.ok) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const data = await response.json();
    if (!data?.id) {
      throw new UnauthorizedException('Could not resolve user from token');
    }

    // Try to resolve local user from DB
    if (this.dataSource) {
      try {
        const rows = await this.dataSource.query(
          `SELECT id, email, role, company_id FROM users WHERE auth_uid = $1 AND deleted_at IS NULL LIMIT 1`,
          [data.id],
        );
        const localUser = rows[0];
        if (localUser) {
          request.user = {
            sub: localUser.id,
            email: localUser.email,
            role: localUser.role,
            companyId: localUser.company_id,
          };
          return true;
        }
      } catch (err) {
        console.error('[JwtAuthGuard] DB lookup failed:', err);
      }
    }

    request.user = {
      sub: data.id,
      email: data.email,
      role: 'company_owner',
      companyId: null,
    };
    return true;
  }

  handleRequest<T>(err: Error | null, user: T, info: Error | undefined): T {
    if (err || !user) {
      throw (
        err || new UnauthorizedException('Token de acceso inválido o expirado')
      );
    }
    return user;
  }
}
