import { FTUE_STEPS, stepIndexOf, type FtueEventName, type FtueStep, type FtueStepId } from './steps';

export type FtueStatus = 'notStarted' | 'active' | 'done';

export type FtueState = {
  status: FtueStatus;
  /** Index in FTUE_STEPS of the step on screen while active. */
  stepIndex: number;
  completed: readonly FtueStepId[];
  skipped: readonly FtueStepId[];
  /** "Ta première Épique !" is celebrated once. */
  epicCelebrated: boolean;
};

export type FtueAction =
  /** A brand-new player reached the tabs: the tour starts. */
  | { type: 'start' }
  /** An existing player on this device: never show the tour. */
  | { type: 'legacy' }
  | { type: 'next' }
  | { type: 'skipStep' }
  | { type: 'skipAll' }
  | { type: 'event'; name: FtueEventName }
  | { type: 'epicCelebrated' };

export const initialFtueState: FtueState = {
  status: 'notStarted',
  stepIndex: 0,
  completed: [],
  skipped: [],
  epicCelebrated: false,
};

/** Events can complete a step slightly ahead (e.g. the pack is torn while the tear hint is still pending). */
const EVENT_LOOKAHEAD = 2;

export function currentStep(state: FtueState): FtueStep | null {
  return state.status === 'active' ? (FTUE_STEPS[state.stepIndex] ?? null) : null;
}

function goTo(state: FtueState, index: number, mark: 'completed' | 'skipped'): FtueState {
  const passed = FTUE_STEPS.slice(state.stepIndex, index).map((step) => step.id);
  const next = {
    ...state,
    completed: mark === 'completed' ? unique([...state.completed, ...passed]) : state.completed,
    skipped: mark === 'skipped' ? unique([...state.skipped, ...passed]) : state.skipped,
  };
  if (index >= FTUE_STEPS.length) return { ...next, status: 'done', stepIndex: FTUE_STEPS.length };
  return { ...next, stepIndex: index };
}

function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

export function ftueReducer(state: FtueState, action: FtueAction): FtueState {
  switch (action.type) {
    case 'start':
      return state.status === 'notStarted' ? { ...initialFtueState, status: 'active' } : state;
    case 'legacy':
      return state.status === 'notStarted' ? { ...state, status: 'done', stepIndex: FTUE_STEPS.length } : state;
    case 'epicCelebrated':
      return { ...state, epicCelebrated: true };
    default:
      break;
  }
  if (state.status !== 'active') return state;

  switch (action.type) {
    case 'next':
      return goTo(state, state.stepIndex + 1, 'completed');
    case 'skipStep':
      return goTo(state, state.stepIndex + 1, 'skipped');
    case 'skipAll':
      return goTo(state, FTUE_STEPS.length, 'skipped');
    case 'event':
      return onEvent(state, action.name);
  }
}

function onEvent(state: FtueState, name: FtueEventName): FtueState {
  const step = FTUE_STEPS[state.stepIndex];
  if (!step) return state;

  if (name === 'packScreenClosed') {
    // Closed before tearing: the pack was not opened, point at the OPEN button again.
    if (step.id === 'tearPack') return { ...state, stepIndex: stepIndexOf('openFirstPack') };
    // Closed during the reveal: the cards are already in the collection, move on.
    if (step.id === 'revealCards') return goTo(state, state.stepIndex + 1, 'completed');
    return state;
  }

  const last = Math.min(FTUE_STEPS.length - 1, state.stepIndex + EVENT_LOOKAHEAD);
  for (let index = state.stepIndex; index <= last; index += 1) {
    if (FTUE_STEPS[index]?.advanceOn === name) return goTo(state, index + 1, 'completed');
  }
  return state;
}

/** Steps that cannot run right now are skipped instead of blocking the tour. */
export function shouldAutoSkip(step: FtueStep, context: { online: boolean; packsLeft: number | null }): boolean {
  if (step.needsOnline && !context.online) return true;
  return step.id === 'openFirstPack' && context.packsLeft === 0;
}

/** "Ta première Épique !": first epic or better card of the tour's first booster. */
export function shouldCelebrateEpic(state: FtueState, rarityRank: number): boolean {
  const step = currentStep(state);
  return step !== null && step.scope === 'pack' && !state.epicCelebrated && rarityRank >= 3;
}

/** Number of the step shown to the player (welcome and summary are not counted). */
export function displayedStep(state: FtueState): { current: number; total: number } {
  const counted = FTUE_STEPS.filter((step) => !step.fullScreen);
  const step = currentStep(state);
  const index = step ? counted.findIndex((candidate) => candidate.id === step.id) : -1;
  return { current: Math.max(0, index) + 1, total: counted.length };
}
