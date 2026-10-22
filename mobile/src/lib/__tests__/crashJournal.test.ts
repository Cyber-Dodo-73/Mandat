import {
  addBreadcrumb,
  clearCrashJournal,
  formatCrashEntry,
  installCrashJournal,
  readCrashJournal,
  recordCrash,
  setCurrentScreen,
} from '../crashJournal';

describe('crash journal', () => {
  beforeEach(() => clearCrashJournal());

  it('records the error with its context, newest first, five at most', () => {
    setCurrentScreen('/quiz');
    addBreadcrumb('api 500 GET /api/v1/me');
    for (let i = 0; i < 6; i++) recordCrash(new TypeError(`boom ${i}`), 'fatal');
    const journal = readCrashJournal();
    expect(journal).toHaveLength(5);
    const latest = journal[0]!;
    expect(latest).toMatchObject({ kind: 'fatal', message: 'TypeError: boom 5', screen: '/quiz' });
    expect(latest.breadcrumbs.join('\n')).toContain('screen /quiz');
    expect(latest.breadcrumbs.join('\n')).toContain('api 500 GET /api/v1/me');
    expect(formatCrashEntry(latest)).toContain('TypeError: boom 5');
  });

  it('keeps non-Error values and never throws', () => {
    expect(recordCrash('plain string', 'rejection')?.message).toBe('plain string');
    expect(recordCrash(undefined, 'rejection')?.message).toBe('undefined');
  });

  it('wraps the global handler and still calls the previous one', () => {
    const previous = jest.fn();
    const errorUtils = { getGlobalHandler: () => previous, setGlobalHandler: jest.fn() };
    (globalThis as { ErrorUtils?: unknown }).ErrorUtils = errorUtils;
    installCrashJournal();
    const handler = errorUtils.setGlobalHandler.mock.calls[0][0] as (error: unknown, fatal?: boolean) => void;
    handler(new Error('fatal one'), true);
    expect(previous).toHaveBeenCalledWith(expect.any(Error), true);
    expect(readCrashJournal()[0]).toMatchObject({ kind: 'fatal', message: 'Error: fatal one' });
  });
});
