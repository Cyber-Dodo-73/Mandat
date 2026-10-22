import * as Sentry from '@sentry/react-native';
import { isRunningInExpoGo } from 'expo';

/**
 * Crash and error reporting (Sentry). Active only when EXPO_PUBLIC_SENTRY_DSN is set: without
 * it every call below is a no-op and the on-device crash journal remains the only record.
 * No personal data is sent: no IP, no screenshots, no session replay; the user is identified
 * by account id only, so reports can be matched to a support request.
 */

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = Boolean(DSN);

export function initMonitoring(): void {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    attachScreenshot: false,
    // Performance: a sample of navigations and app starts, enough to spot slow screens.
    tracesSampleRate: __DEV__ ? 1 : 0.2,
    integrations: [Sentry.expoRouterIntegration({ enableTimeToInitialDisplay: !isRunningInExpoGo() })],
    enableNativeFramesTracking: !isRunningInExpoGo(),
    // Failed API calls are already breadcrumbs with their status; 5xx become their own events.
    enableCaptureFailedRequests: true,
  });
}

/** Account id of the signed-in player (null on sign out). */
export function setMonitoringUser(id: string | null): void {
  if (!monitoringEnabled) return;
  Sentry.setUser(id ? { id } : null);
}

export function addMonitoringBreadcrumb(message: string): void {
  if (!monitoringEnabled) return;
  Sentry.addBreadcrumb({ message, level: 'info' });
}

export function captureMonitoringError(error: unknown, context?: Record<string, unknown>): void {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function captureMonitoringMessage(message: string, level: 'info' | 'warning' | 'error'): void {
  if (!monitoringEnabled) return;
  Sentry.captureMessage(message, level);
}

/** Wraps the root component so Sentry sees app start, touch events and the navigation tree. */
export function wrapRoot<P extends Record<string, unknown>>(component: React.ComponentType<P>): React.ComponentType<P> {
  return monitoringEnabled ? Sentry.wrap(component) : component;
}

/** Wraps the route error boundary so render errors reach Sentry with their route attached. */
export const wrapErrorBoundary = Sentry.wrapExpoRouterErrorBoundary;
