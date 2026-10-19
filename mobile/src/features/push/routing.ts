/**
 * In-app route to open when a notification is tapped. Server pushes carry `path`; the local
 * reminders carry `kind`. Only absolute app paths are accepted (never external URLs).
 */
const LOCAL_KIND_PATHS: Record<string, string> = {
  packReady: '/',
  streakAtRisk: '/streak',
};

export function pathFromNotificationData(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return null;
  const { path, kind } = data as { path?: unknown; kind?: unknown };
  if (typeof path === 'string' && /^\/[A-Za-z0-9/_\-[\]?=&.]*$/.test(path) && !path.startsWith('//')) return path;
  if (typeof kind === 'string' && kind in LOCAL_KIND_PATHS) return LOCAL_KIND_PATHS[kind] ?? null;
  return null;
}
