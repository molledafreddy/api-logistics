import * as Sentry from '@sentry/node';
import { Logger } from '@nestjs/common';

const logger = new Logger('Sentry');

interface SentryInitOptions {
  dsn: string;
  environment: string;
  release: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
}

/**
 * Inicializa Sentry de forma idempotente. Debe llamarse antes de NestFactory.create()
 * para que el SDK capture errores tempranos.
 */
export function initSentry(opts: SentryInitOptions): boolean {
  if (!opts.enabled || !opts.dsn) {
    logger.log('Sentry deshabilitado (sin SENTRY_DSN)');
    return false;
  }

  try {
    Sentry.init({
      dsn: opts.dsn,
      environment: opts.environment,
      release: opts.release,
      tracesSampleRate: opts.tracesSampleRate,
      // Profiling se carga sólo si la sample rate > 0 para evitar overhead
      ...(opts.profilesSampleRate > 0
        ? { profilesSampleRate: opts.profilesSampleRate }
        : {}),
      // Filtra ruido típico
      ignoreErrors: [
        'UnauthorizedException',
        'ForbiddenException',
        'NotFoundException',
        'ThrottlerException',
      ],
    });

    logger.log(`Sentry inicializado [env=${opts.environment}]`);
    return true;
  } catch (err) {
    logger.error('Error inicializando Sentry', (err as Error).stack);
    return false;
  }
}

export { Sentry };
