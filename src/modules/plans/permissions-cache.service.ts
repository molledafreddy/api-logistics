import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

@Injectable()
export class PermissionsCacheService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getPermissionsCache(companyId: string): Promise<string[] | null> {
    const value = await this.cacheManager.get<string[]>(
      `company:${companyId}:permissions`,
    );
    return value ?? null;
  }

  async setPermissionsCache(
    companyId: string,
    permissions: string[],
    ttl = 3600,
  ): Promise<void> {
    await this.cacheManager.set(
      `company:${companyId}:permissions`,
      permissions,
      ttl,
    );
  }

  async invalidatePermissionsCache(companyId: string): Promise<void> {
    await this.cacheManager.del(`company:${companyId}:permissions`);
  }
}
