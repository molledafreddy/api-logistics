import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/**
 * PermissionsCacheService — global
 *
 * Cachea los códigos de permisos efectivos por empresa (resultado de:
 *   subscriptions.activa.plan_id → plan_permissions → permission_definitions)
 *
 * Clave: `company:{companyId}:permissions`
 * TTL:   5 min por defecto (configurable). Se invalida explícitamente cuando
 *        cambia la suscripción/plan/permisos.
 *
 * Es invocado tanto por el `PermissionGuard` (lectura en cada request) como
 * por `PlansService` / `SubscriptionsService` (invalidación al modificar).
 */
@Injectable()
export class PermissionsCacheService {
  private readonly logger = new Logger(PermissionsCacheService.name);
  private readonly defaultTtlMs = 5 * 60 * 1000;

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private key(companyId: string): string {
    return `company:${companyId}:permissions`;
  }

  async get(companyId: string): Promise<string[] | null> {
    try {
      const value = await this.cache.get<string[]>(this.key(companyId));
      return value ?? null;
    } catch (err) {
      this.logger.warn(`Fallo al leer cache: ${(err as Error).message}`);
      return null;
    }
  }

  async set(
    companyId: string,
    permissions: string[],
    ttlMs?: number,
  ): Promise<void> {
    try {
      await this.cache.set(
        this.key(companyId),
        permissions,
        ttlMs ?? this.defaultTtlMs,
      );
    } catch (err) {
      this.logger.warn(`Fallo al escribir cache: ${(err as Error).message}`);
    }
  }

  async invalidate(companyId: string): Promise<void> {
    try {
      await this.cache.del(this.key(companyId));
    } catch (err) {
      this.logger.warn(
        `Fallo al invalidar cache de ${companyId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Helper que devuelve los permisos cacheados o ejecuta el loader y guarda.
   */
  async getOrLoad(
    companyId: string,
    loader: () => Promise<string[]>,
    ttlMs?: number,
  ): Promise<string[]> {
    const cached = await this.get(companyId);
    if (cached) return cached;
    const fresh = await loader();
    await this.set(companyId, fresh, ttlMs);
    return fresh;
  }

  // ─── Compat con la API antigua de plans/permissions-cache.service ───
  // Permite migrar progresivamente PlansService sin romper.
  async getPermissionsCache(companyId: string): Promise<string[] | null> {
    return this.get(companyId);
  }
  async setPermissionsCache(
    companyId: string,
    permissions: string[],
    ttlSeconds = 300,
  ): Promise<void> {
    return this.set(companyId, permissions, ttlSeconds * 1000);
  }
  async invalidatePermissionsCache(companyId: string): Promise<void> {
    return this.invalidate(companyId);
  }
}
