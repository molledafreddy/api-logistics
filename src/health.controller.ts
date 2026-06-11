import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import Redis from 'ioredis';
import { Public } from './common/decorators/public.decorator';
import { getRedisConnection } from './config/redis-connection.helper';

interface IDependencyStatus {
  status: 'up' | 'down';
  latencyMs?: number;
  error?: string;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check (liveness simple)' })
  @ApiResponse({ status: 200, description: 'API arriba' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.APP_VERSION || '1.0.0',
      env: process.env.NODE_ENV || 'development',
    };
  }

  @Public()
  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe — el proceso responde (Kubernetes/Docker)',
  })
  @ApiResponse({ status: 200, description: 'Proceso vivo' })
  live() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      pid: process.pid,
      uptime: process.uptime(),
    };
  }

  @Public()
  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe — la API puede atender tráfico (DB + Redis)',
  })
  @ApiResponse({ status: 200, description: 'Listo para tráfico' })
  @ApiResponse({ status: 503, description: 'Una dependencia no responde' })
  async ready() {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const ok = database.status === 'up' && redis.status === 'up';
    const payload = {
      status: ok ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      checks: { database, redis },
    };

    if (!ok) {
      throw new ServiceUnavailableException(payload);
    }
    return payload;
  }

  private async checkDatabase(): Promise<IDependencyStatus> {
    const start = Date.now();
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: (err as Error).message,
      };
    }
  }

  private async checkRedis(): Promise<IDependencyStatus> {
    const start = Date.now();
    const { host, port, password, tls } = getRedisConnection();
    const client = new Redis({
      host,
      port,
      password,
      tls: tls as any,
      lazyConnect: true,
      connectTimeout: 1500,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });
    try {
      await client.connect();
      await client.ping();
      return { status: 'up', latencyMs: Date.now() - start };
    } catch (err) {
      return {
        status: 'down',
        latencyMs: Date.now() - start,
        error: (err as Error).message,
      };
    } finally {
      try {
        client.disconnect();
      } catch {
        /* noop */
      }
    }
  }
}
