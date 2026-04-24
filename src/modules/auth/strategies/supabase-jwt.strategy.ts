import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { passportJwtSecret } from 'jwks-rsa';
import { Request } from 'express';
import { SupabaseService } from '../supabase.service';
import { User } from '../entities/user.entity';
import { IUserPayload } from '../../../common/interfaces/user-payload.interface';

interface SupabaseJwtPayload {
  sub: string; // Supabase auth user id
  email?: string;
  role?: string; // Supabase role (anon, authenticated, service_role)
  aud?: string;
  iat?: number;
  exp?: number;
  session_id?: string; // Supabase session id
}

@Injectable()
export class SupabaseJwtStrategy extends PassportStrategy(
  Strategy,
  'supabase-jwt',
) {
  private readonly logger = new Logger(SupabaseJwtStrategy.name);

  constructor(
    configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly supabaseService: SupabaseService,
  ) {
    // Leer configuración de Supabase
    const supabaseUrl =
      process.env.SUPABASE_URL || configService.get<string>('supabase.url')!;
    const jwksUri = `${supabaseUrl}/auth/v1/.well-known/jwks.json`;
    const issuer = `${supabaseUrl}/auth/v1`;
    // El audience por defecto de Supabase es 'authenticated', pero puede variar
    const audience = process.env.SUPABASE_JWT_AUD || 'authenticated';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri,
      }),
      // algorithms: ['ES256'], // Eliminado para relajar validación
      issuer,
      audience,
      passReqToCallback: true,
    });

    this.logger.log(
      `[SUPABASE_JWT] Inicializando estrategia con JWKS: ${jwksUri}`,
    );
    this.logger.log(`[SUPABASE_JWT] issuer: ${issuer}, audience: ${audience}`);
    this.logger.log(
      `[SUPABASE_JWT] Estrategia Passport inicializada correctamente`,
    );
  }

  /**
   * Called by Passport after JWT signature is verified.
   * We verify the session is still active in Supabase, then look up our local User.
   * With passReqToCallback=true, the first argument is the request.
   */
  async validate(
    req: Request,
    payload: SupabaseJwtPayload,
  ): Promise<IUserPayload> {
    this.logger.log('[SUPABASE_JWT] validate() INICIO', { payload });
    try {
      const { sub: authUid } = payload;

      if (!authUid) {
        this.logger.warn('[SUPABASE_JWT] Invalid token: missing subject');
        throw new UnauthorizedException('Invalid token: missing subject');
      }

      // Verify the session is still active in Supabase
      const accessToken = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
      this.logger.log('[SUPABASE_JWT] accessToken extraído', { accessToken });
      if (accessToken) {
        const isSessionValid = await this.verifySessionActive(accessToken);
        this.logger.log('[SUPABASE_JWT] isSessionValid', { isSessionValid });
        if (!isSessionValid) {
          this.logger.warn('[SUPABASE_JWT] Session has been revoked');
          throw new UnauthorizedException('Session has been revoked');
        }
      }

      const user = await this.userRepository.findOne({
        where: { authUid, deletedAt: undefined },
      });
      this.logger.log('[SUPABASE_JWT] user encontrado', { user });

      if (!user) {
        this.logger.warn('[SUPABASE_JWT] User not found');
        throw new UnauthorizedException('User not found');
      }

      if (user.status === 'suspended') {
        this.logger.warn('[SUPABASE_JWT] Account suspended');
        throw new UnauthorizedException('Account suspended');
      }

      if (user.status === 'inactive') {
        this.logger.warn('[SUPABASE_JWT] Account deactivated');
        throw new UnauthorizedException('Account deactivated');
      }

      if (user.isLocked) {
        this.logger.warn('[SUPABASE_JWT] Account temporarily locked');
        throw new UnauthorizedException('Account temporarily locked');
      }

      this.logger.log('[SUPABASE_JWT] Usuario autenticado OK', { user });
      return {
        sub: user.id,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
      };
    } catch (err) {
      this.logger.error('[SUPABASE_JWT] ERROR en validate', err);
      throw err;
    }
  }

  /**
   * Verify that the session behind this access token is still active in Supabase.
   * Uses the admin client to get the user, then checks if the token can retrieve the user.
   */
  private async verifySessionActive(accessToken: string): Promise<boolean> {
    this.logger.log('[SUPABASE_JWT] verifySessionActive() INICIO', {
      accessToken,
    });
    try {
      const supabaseUrl =
        process.env.SUPABASE_URL ||
        this.supabaseService['configService'].get<string>('supabase.url');
      const apikey =
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        this.supabaseService['configService'].get<string>(
          'supabase.serviceRoleKey',
        ) ||
        '';
      const endpoint = `${supabaseUrl}/auth/v1/user`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: String(apikey),
        } as Record<string, string>,
      });
      const data = await response.json();
      this.logger.log('[SUPABASE_JWT] Resultado fetch /auth/v1/user', {
        status: response.status,
        data,
      });

      // GoTrue's GET /auth/v1/user returns the user object directly at the root
      // (e.g. { id, email, aud, role, ... }), NOT wrapped in a `user` property.
      // Some clients (supabase-js) wrap it as { user: {...} }, so we accept both.
      const user = data?.user ?? (data?.id ? data : null);

      if (!response.ok || !user) {
        this.logger.debug(
          `[SUPABASE_JWT] Session verification failed: ${data?.msg || data?.error_description || data?.error || 'no user'}`,
        );
        return false;
      }

      return true;
    } catch (err) {
      this.logger.warn(
        `[SUPABASE_JWT] Session verification error: ${(err as Error).message}`,
      );
      return false;
    }
  }
}
