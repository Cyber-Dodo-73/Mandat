import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { addMonitoringBreadcrumb } from './monitoring';
import { storage } from './storage';

/**
 * On-device crash journal. Release builds show nothing when JavaScript throws: the app just
 * restarts. Every fatal error, render error and unhandled promise rejection is written here,
 * synchronously (MMKV), before the default handler takes the app down, so it can be read from
 * the Diagnostics screen after the restart. No network, no third party.
 */

export type CrashKind = 'fatal' | 'render' | 'rejection';

export type CrashEntry = {
  kind: CrashKind;
  at: string;
  message: string;
  stack: string | null;
  /** Route the player was on. */
  screen: string | null;
  /** Last things that happened before (navigation, failed API calls), oldest first. */
  breadcrumbs: string[];
  appVersion: string;
  build: string | null;
  os: string;
};

const JOURNAL_KEY = 'diagnostics.crashJournal';
const MAX_ENTRIES = 5;
const MAX_BREADCRUMBS = 25;
const MAX_STACK_CHARS = 4000;

let currentScreen: string | null = null;
const breadcrumbs: string[] = [];
let installed = false;

/** Called by the navigation root when the route changes. */
export function setCurrentScreen(path: string): void {
  if (path === currentScreen) return;
  currentScreen = path;
  addBreadcrumb(`screen ${path}`);
}

export function addBreadcrumb(text: string): void {
  addMonitoringBreadcrumb(text);
  breadcrumbs.push(`${new Date().toISOString().slice(11, 19)} ${text}`);
  if (breadcrumbs.length > MAX_BREADCRUMBS) breadcrumbs.splice(0, breadcrumbs.length - MAX_BREADCRUMBS);
}

export function readCrashJournal(): CrashEntry[] {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(JOURNAL_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function clearCrashJournal(): void {
  storage.removeItem(JOURNAL_KEY);
}

/** Writes an entry at the head of the journal. Never throws: it runs inside error handlers. */
export function recordCrash(error: unknown, kind: CrashKind): CrashEntry | null {
  try {
    const entry = toEntry(error, kind);
    const next = [entry, ...readCrashJournal()].slice(0, MAX_ENTRIES);
    storage.setItem(JOURNAL_KEY, JSON.stringify(next));
    return entry;
  } catch {
    return null;
  }
}

/** Plain-text report of one entry, meant to be copied and sent. */
export function formatCrashEntry(entry: CrashEntry): string {
  return [
    `MANDAT ${entry.appVersion}${entry.build ? ` (${entry.build})` : ''} on ${entry.os}`,
    `${entry.kind} at ${entry.at}${entry.screen ? ` on ${entry.screen}` : ''}`,
    '',
    entry.message,
    entry.stack ?? '',
    '',
    'Before:',
    ...entry.breadcrumbs,
  ].join('\n');
}

type GlobalErrorHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsLike = { getGlobalHandler: () => GlobalErrorHandler; setGlobalHandler: (handler: GlobalErrorHandler) => void };
type RejectionTracker = { enablePromiseRejectionTracker?: (options: { allRejections: boolean; onUnhandled: (id: number, error: unknown) => void; onHandled?: (id: number) => void }) => void };

/**
 * Hooks the React Native global error handler and Hermes' rejection tracker. The default
 * handler still runs afterwards: a fatal error keeps producing the native crash report.
 */
export function installCrashJournal(): void {
  if (installed) return;
  installed = true;
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (errorUtils) {
    const previous = errorUtils.getGlobalHandler();
    errorUtils.setGlobalHandler((error, isFatal) => {
      recordCrash(error, isFatal ? 'fatal' : 'rejection');
      previous(error, isFatal);
    });
  }
  const hermes = (globalThis as { HermesInternal?: RejectionTracker }).HermesInternal;
  hermes?.enablePromiseRejectionTracker?.({
    allRejections: true,
    onUnhandled: (_id, error) => {
      recordCrash(error, 'rejection');
    },
  });
}

function toEntry(error: unknown, kind: CrashKind): CrashEntry {
  const err = error instanceof Error ? error : null;
  const message = err ? `${err.name}: ${err.message}` : String(error);
  const stack = err?.stack ? err.stack.slice(0, MAX_STACK_CHARS) : null;
  const config = Constants.expoConfig;
  const build =
    Platform.OS === 'ios' ? (config?.ios?.buildNumber ?? null) : config?.android?.versionCode?.toString() ?? null;
  return {
    kind,
    at: new Date().toISOString(),
    message,
    stack,
    screen: currentScreen,
    breadcrumbs: [...breadcrumbs],
    appVersion: config?.version ?? '?',
    build,
    os: `${Platform.OS} ${Platform.Version}`,
  };
}

function isEntry(value: unknown): value is CrashEntry {
  const entry = value as Partial<CrashEntry> | null;
  return typeof entry === 'object' && entry !== null && typeof entry.message === 'string' && typeof entry.at === 'string';
}
