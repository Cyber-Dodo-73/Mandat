/**
 * First-time user experience: the guided tour a brand-new player gets after sign-up.
 * Pure data, so the state machine stays testable without React.
 */

/** Overlay hosts: the tab screens, and the full-screen pack opening modal (its own native layer). */
export type FtueScope = 'tabs' | 'pack';

/** Tab routes a step lives on; the tour offers to go there when the player is elsewhere. */
export type FtueRoute = '/' | '/collection' | '/missions' | '/play';

/** Elements a step can spotlight, registered by screens with `useFtueAnchor(id)`. */
export type FtueAnchorId = 'home.open' | 'pack.booster' | 'collection.progress' | 'missions.daily' | 'play.quiz';

/** Things that happen in the app and move the tour forward on their own. */
export type FtueEventName = 'packScreenOpened' | 'packTorn' | 'packRevealed' | 'packScreenClosed' | 'quizStarted';

export type FtueStepId =
  | 'welcome'
  | 'openFirstPack'
  | 'tearPack'
  | 'revealCards'
  | 'collectionIntro'
  | 'collectionRarity'
  | 'collectionProgress'
  | 'missionsDaily'
  | 'missionsStreak'
  | 'playQuiz'
  | 'finish';

export type FtueStep = {
  id: FtueStepId;
  scope: FtueScope;
  /** Tab the step belongs to; undefined = shown wherever the player is. */
  route?: FtueRoute;
  anchor?: FtueAnchorId;
  /** 'next' = the bubble's button; an event name = done when that happens in the app. */
  advanceOn: 'next' | FtueEventName;
  /** Needs the server (opening a booster, starting a quiz): skipped offline. */
  needsOnline?: boolean;
  /** Takes the whole screen (welcome, summary) instead of a bubble. */
  fullScreen?: boolean;
};

export const FTUE_STEPS: readonly FtueStep[] = [
  { id: 'welcome', scope: 'tabs', advanceOn: 'next', fullScreen: true },
  { id: 'openFirstPack', scope: 'tabs', route: '/', anchor: 'home.open', advanceOn: 'packScreenOpened', needsOnline: true },
  { id: 'tearPack', scope: 'pack', anchor: 'pack.booster', advanceOn: 'packTorn' },
  { id: 'revealCards', scope: 'pack', advanceOn: 'packRevealed' },
  { id: 'collectionIntro', scope: 'tabs', route: '/collection', advanceOn: 'next' },
  { id: 'collectionRarity', scope: 'tabs', route: '/collection', advanceOn: 'next' },
  { id: 'collectionProgress', scope: 'tabs', route: '/collection', anchor: 'collection.progress', advanceOn: 'next' },
  { id: 'missionsDaily', scope: 'tabs', route: '/missions', anchor: 'missions.daily', advanceOn: 'next' },
  { id: 'missionsStreak', scope: 'tabs', route: '/missions', advanceOn: 'next' },
  { id: 'playQuiz', scope: 'tabs', route: '/play', anchor: 'play.quiz', advanceOn: 'next' },
  { id: 'finish', scope: 'tabs', advanceOn: 'next', fullScreen: true },
];

export const FTUE_STEP_COUNT = FTUE_STEPS.length;

export function stepIndexOf(id: FtueStepId): number {
  return FTUE_STEPS.findIndex((step) => step.id === id);
}
