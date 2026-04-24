import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../../src/common/decorators/public.decorator';

/**
 * Test-only Auth Guard that bypasses JWKS/Passport completely.
 * It validates the Supabase access token by calling /auth/v1/user directly,
 * then resolves the local user from the database.
 * This avoids the hanging issue caused by jwks-rsa in test environments.
 */
@Injectable()
export class TestAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException(
        'Missing or invalid Authorization header',
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // Validate token directly with Supabase (no JWKS needed)
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

    // Resolve local user from DB using the app's datasource
    const dataSource = request.app?.get?.('DataSource') || null;
    let localUser: any = null;

    if (dataSource) {
      try {
        const rows = await dataSource.query(
          `SELECT id, email, role, company_id FROM users WHERE auth_uid = $1 AND deleted_at IS NULL LIMIT 1`,
          [data.id],
        );
        localUser = rows[0] || null;
      } catch {
        // DB query failed, fall through to basic payload
      }
    }

    // Attach user payload to request (same shape as IUserPayload)
    request.user = localUser
      ? {
          sub: localUser.id,
          email: localUser.email,
          role: localUser.role,
          companyId: localUser.company_id,
        }
      : {
          sub: data.id,
          email: data.email,
          role: 'company_owner',
          companyId: null,
        };

    return true;
  }
}
