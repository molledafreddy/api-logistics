import { Inject, Injectable, Logger } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';

/**
 * OptimizationReoptCacheService
 * Guarda el número de reoptimizaciones por día y empresa en Redis.
 * Clave: optimization:reopt:{companyId}:{date}
 */
@Injectable()
export class OptimizationReoptCacheService {
  private readonly logger = new Logger(OptimizationReoptCacheService.name);
  private readonly defaultTtlSec = 24 * 60 * 60; // 1 día

  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  private key(companyId: string, date: string): string {
    return `optimization:reopt:${companyId}:${date}`;
  }

  async get(companyId: string, date: string): Promise<number> {
    try {
      const value = await this.cache.get<number>(this.key(companyId, date));
      return value ?? 0;
    } catch (err) {
      this.logger.warn(`Fallo al leer cache: ${(err as Error).message}`);
      return 0;
    }
  }

  async incr(companyId: string, date: string): Promise<number> {
    const key = this.key(companyId, date);
    let value = await this.get(companyId, date);
    value++;
    await this.cache.set(key, value, this.defaultTtlSec);
    return value;
  }

  async reset(companyId: string, date: string): Promise<void> {
    await this.cache.del(this.key(companyId, date));
  }
}
