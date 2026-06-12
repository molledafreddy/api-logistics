// @sentry/node v10 uses require-in-the-middle + OpenTelemetry instrumentation
// hooks that deadlock on Alpine Linux / Node 22 during module loading — the
// process hangs before any application code runs.  Sentry is disabled until
// the SDK ships a fix or we migrate to a compatible version.

interface SentryInitOptions {
  dsn: string;
  environment: string;
  release: string;
  tracesSampleRate: number;
  profilesSampleRate: number;
  enabled: boolean;
}

export function initSentry(_opts: SentryInitOptions): boolean {
  return false;
}

// Re-export a no-op Sentry object so existing call-sites compile without changes.
export const Sentry = {
  captureException: (_err: unknown, _ctx?: unknown) => '',
  captureMessage: (_msg: string, _level?: unknown) => '',
  setUser: (_user: unknown) => {},
  setTag: (_key: string, _value: unknown) => {},
  setExtra: (_key: string, _value: unknown) => {},
  addBreadcrumb: (_breadcrumb: unknown) => {},
  withScope: (_cb: (scope: unknown) => void) => {},
  startSpan: (_opts: unknown, _cb: () => unknown) => {},
};
