import {
  currentStep,
  displayedStep,
  ftueReducer,
  initialFtueState,
  shouldAutoSkip,
  shouldCelebrateEpic,
  type FtueAction,
  type FtueState,
} from '../machine';
import { FTUE_STEPS, stepIndexOf, type FtueStepId } from '../steps';

const run = (actions: FtueAction[], from: FtueState = initialFtueState): FtueState =>
  actions.reduce(ftueReducer, from);

const at = (id: FtueStepId): FtueState => ({ ...initialFtueState, status: 'active', stepIndex: stepIndexOf(id) });

describe('ftue state machine', () => {
  it('starts on the welcome screen for a new player only', () => {
    expect(currentStep(run([{ type: 'start' }]))?.id).toBe('welcome');
    const legacy = run([{ type: 'legacy' }]);
    expect(legacy.status).toBe('done');
    // Once decided, nothing restarts it.
    expect(run([{ type: 'start' }], legacy).status).toBe('done');
  });

  it('walks every step to the end with "next" and app events', () => {
    let state = run([{ type: 'start' }, { type: 'next' }]);
    expect(currentStep(state)?.id).toBe('openFirstPack');
    state = run(
      [
        { type: 'event', name: 'packScreenOpened' },
        { type: 'event', name: 'packTorn' },
        { type: 'event', name: 'packRevealed' },
      ],
      state,
    );
    expect(currentStep(state)?.id).toBe('collectionIntro');
    for (let i = 0; i < 6; i += 1) state = ftueReducer(state, { type: 'next' });
    expect(currentStep(state)?.id).toBe('finish');
    state = ftueReducer(state, { type: 'next' });
    expect(state.status).toBe('done');
    expect(state.completed).toEqual(FTUE_STEPS.map((step) => step.id));
    expect(state.skipped).toEqual([]);
  });

  it('ignores "next" on steps that wait for an app event, and unrelated events', () => {
    const state = at('openFirstPack');
    expect(currentStep(ftueReducer(state, { type: 'event', name: 'quizStarted' }))?.id).toBe('openFirstPack');
    // The bubble still offers "Passer", which always moves on.
    expect(currentStep(ftueReducer(state, { type: 'skipStep' }))?.id).toBe('tearPack');
  });

  it('accepts an event slightly ahead (pack torn while the open hint was showing)', () => {
    const state = ftueReducer(at('openFirstPack'), { type: 'event', name: 'packTorn' });
    expect(currentStep(state)?.id).toBe('revealCards');
    expect(state.completed).toEqual(['openFirstPack', 'tearPack']);
  });

  it('goes back to the OPEN hint when the pack screen is closed before tearing', () => {
    expect(currentStep(ftueReducer(at('tearPack'), { type: 'event', name: 'packScreenClosed' }))?.id).toBe('openFirstPack');
    // Closed during the reveal: cards are already owned, the tour moves on.
    expect(currentStep(ftueReducer(at('revealCards'), { type: 'event', name: 'packScreenClosed' }))?.id).toBe('collectionIntro');
    // Elsewhere it changes nothing.
    expect(currentStep(ftueReducer(at('missionsDaily'), { type: 'event', name: 'packScreenClosed' }))?.id).toBe('missionsDaily');
  });

  it('skips one step or the whole tour, recording what was skipped', () => {
    const skippedOne = ftueReducer(at('collectionRarity'), { type: 'skipStep' });
    expect(currentStep(skippedOne)?.id).toBe('collectionProgress');
    expect(skippedOne.skipped).toEqual(['collectionRarity']);

    const quit = ftueReducer(at('collectionRarity'), { type: 'skipAll' });
    expect(quit.status).toBe('done');
    expect(quit.skipped).toContain('finish');
    expect(currentStep(quit)).toBeNull();
  });

  it('resumes on the persisted step (state is plain data)', () => {
    const persisted = JSON.parse(JSON.stringify(run([{ type: 'start' }, { type: 'next' }, { type: 'skipStep' }]))) as FtueState;
    expect(currentStep(persisted)?.id).toBe('tearPack');
    expect(currentStep(ftueReducer(persisted, { type: 'event', name: 'packTorn' }))?.id).toBe('revealCards');
  });

  it('does nothing once done', () => {
    const done = run([{ type: 'start' }, { type: 'skipAll' }]);
    expect(run([{ type: 'next' }, { type: 'event', name: 'packTorn' }], done)).toBe(done);
  });

  it('auto-skips server steps offline and the first pack when no booster is left', () => {
    const open = FTUE_STEPS[stepIndexOf('openFirstPack')]!;
    const intro = FTUE_STEPS[stepIndexOf('collectionIntro')]!;
    expect(shouldAutoSkip(open, { online: false, packsLeft: 2 })).toBe(true);
    expect(shouldAutoSkip(open, { online: true, packsLeft: 0 })).toBe(true);
    expect(shouldAutoSkip(open, { online: true, packsLeft: null })).toBe(false);
    expect(shouldAutoSkip(intro, { online: false, packsLeft: 0 })).toBe(false);
  });

  it('celebrates the first epic or better once, only during the pack steps', () => {
    expect(shouldCelebrateEpic(at('revealCards'), 3)).toBe(true);
    expect(shouldCelebrateEpic(at('revealCards'), 2)).toBe(false);
    expect(shouldCelebrateEpic({ ...at('revealCards'), epicCelebrated: true }, 5)).toBe(false);
    expect(shouldCelebrateEpic(at('collectionIntro'), 5)).toBe(false);
  });

  it('numbers the coached steps for the bubble counter', () => {
    expect(displayedStep(at('openFirstPack'))).toEqual({ current: 1, total: FTUE_STEPS.length - 2 });
    expect(displayedStep(at('playQuiz'))).toEqual({ current: FTUE_STEPS.length - 2, total: FTUE_STEPS.length - 2 });
  });
});
