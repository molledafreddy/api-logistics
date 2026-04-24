import { registerAs } from '@nestjs/config';

/**
 * Configuración de Rate Limiting con 3 buckets:
 *  - short:  ráfagas (anti-bot, scraping inmediato)
 *  - medium: por defecto en endpoints normales
 *  - long:   ventana amplia anti-abuso sostenido
 *
 * Los endpoints sensibles (login, register, refresh) usan @Throttle()
 * a nivel de controlador con límites específicos.
 */
export const throttleConfig = registerAs('throttle', () => ({
  short: {
    ttl: parseInt(process.env.THROTTLE_SHORT_TTL || '1000', 10),
    limit: parseInt(process.env.THROTTLE_SHORT_LIMIT || '10', 10),
  },
  medium: {
    ttl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT || '100', 10),
  },
  long: {
    ttl: parseInt(process.env.THROTTLE_LONG_TTL || '3600000', 10),
    limit: parseInt(process.env.THROTTLE_LONG_LIMIT || '1000', 10),
  },
}));
