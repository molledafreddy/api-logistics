import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as jwt from 'jsonwebtoken';
import { JwtHeader, SigningKeyCallback, VerifyErrors } from 'jsonwebtoken';
import type { JwksClient, Options as JwksOptions } from 'jwks-rsa';
// jwks-rsa exporta el factory como module.exports (CJS) y como default (ESM).
// Usamos require para asegurar compatibilidad con ts-jest/CommonJS sin perder tipado.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const jwksRsaModule = require('jwks-rsa');
const jwksClient: (options: JwksOptions) => JwksClient =
  jwksRsaModule.default ?? jwksRsaModule;
import { Socket } from 'socket.io';
import { User } from '../modules/auth/entities/user.entity';
import { IUserPayload } from '../common/interfaces/user-payload.interface';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

/**
 * Servicio de autenticación para conexiones WebSocket.
 * Reusa el mismo flujo JWKS de Supabase que la estrategia HTTP, pero adaptado
 * a sockets (lee el token del handshake en lugar del header HTTP).
 */
@Injectable()
export class WsAuthService {
  private readonly logger = new Logger(WsAuthService.name);
  private readonly jwks: JwksClient;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      this.configService.get<string>('supabase.url')!;
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.audience = process.env.SUPABASE_JWT_AUD || 'authenticated';
    this.jwks = jwksClient({
      jwksUri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
    });
  }

  /**
   * Extrae el token del handshake del socket.
   * Acepta `auth.token` (preferido) o `Authorization: Bearer <token>` en headers.
   */
  extractToken(socket: Socket): string | null {
    const authToken = (socket.handshake.auth as { token?: string })?.token;
    if (authToken) return authToken.replace(/^Bearer\s+/i, '');

    const header =
      socket.handshake.headers.authorization ||
      socket.handshake.headers.Authorization;
    if (
      typeof header === 'string' &&
      header.toLowerCase().startsWith('bearer ')
    ) {
      return header.slice(7);
    }
    return null;
  }

  /**
   * Verifica firma del JWT contra JWKS y devuelve el payload tipado.
   */
  private verifyJwt(token: string): Promise<SupabaseJwtPayload> {
    return new Promise((resolve, reject) => {
      jwt.verify(
        token,
        (header: JwtHeader, callback: SigningKeyCallback) => {
          this.jwks.getSigningKey(header.kid, (err, key) => {
            if (err) return callback(err);
            callback(null, key?.getPublicKey());
          });
        },
        {
          issuer: this.issuer,
          audience: this.audience,
        },
        (err: VerifyErrors | null, decoded: unknown) => {
          if (err) return reject(err);
          resolve(decoded as SupabaseJwtPayload);
        },
      );
    });
  }

  /**
   * Autentica un socket completo: verifica JWT, busca el User local,
   * y devuelve el payload usado en el resto del sistema.
   */
  async authenticate(socket: Socket): Promise<IUserPayload> {
    const token = this.extractToken(socket);
    if (!token) {
      throw new UnauthorizedException('Missing JWT token in handshake');
    }

    let payload: SupabaseJwtPayload;
    try {
      payload = await this.verifyJwt(token);
    } catch (err) {
      this.logger.warn(`[WS] Invalid JWT: ${(err as Error).message}`);
      throw new UnauthorizedException('Invalid JWT token');
    }

    if (!payload.sub) {
      throw new UnauthorizedException('JWT missing subject');
    }

    const user = await this.userRepository.findOne({
      where: { authUid: payload.sub },
    });

    if (!user) throw new UnauthorizedException('User not found');
    if (user.status === 'suspended') {
      throw new UnauthorizedException('Account suspended');
    }
    if (user.status === 'inactive') {
      throw new UnauthorizedException('Account deactivated');
    }
    if (user.isLocked) {
      throw new UnauthorizedException('Account temporarily locked');
    }

    return {
      sub: user.id,
      email: user.email,
      role: user.role,
      companyId: user.companyId,
    };
  }
}
