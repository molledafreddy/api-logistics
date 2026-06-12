/**
 * Sentry stub — disabled due to deadlock on Alpine Linux + Node 22.
 * @sentry/node v10 initializes OpenTelemetry during import, causing a deadlock
 * in the module loading phase before any application code runs.
 *
 * This stub maintains the same API surface so no other code needs to change.
 * Error tracking can be re-added later with a different provider.
 */

interface SentryInitOptions {
  dsn: string;
  environment: string;
  release: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
}

export function initSentry(opts: SentryInitOptions): boolean {
  // No-op: Sentry disabled
  return false;
}

export const Sentry = {
  // Stub object for any code that might reference Sentry
};
