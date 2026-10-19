import { router, usePathname, type Href } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { AccessibilityInfo, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { useSessionStore } from '@/features/auth/session';
import { usePacksQuery } from '@/features/packs/queries';
import { useCelebrations } from '@/features/progression/celebrations';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useTranslation } from '@/i18n';

import { useAnchorRect, type FtueRect } from './anchors';
import { trackFtue } from './analytics';
import { BladeHint } from './BladeHint';
import { CoachBubble, type CoachAction } from './CoachBubble';
import { EpicBanner } from './EpicBanner';
import { FinishStep } from './FinishStep';
import { currentStep, displayedStep, shouldAutoSkip } from './machine';
import { Spotlight } from './Spotlight';
import { type FtueRoute, type FtueScope, type FtueStep, type FtueStepId } from './steps';
import { ftueEvent, useFtueStore } from './store';
import { WelcomeStep } from './WelcomeStep';

const GO_TO_LABEL = {
  '/': 'ftue.goTo.home',
  '/collection': 'ftue.goTo.collection',
  '/missions': 'ftue.goTo.missions',
  '/play': 'ftue.goTo.play',
} as const satisfies Record<FtueRoute, string>;

/** Steps drawn as a coach bubble (welcome and summary are full screens). */
type CoachStepId = Exclude<FtueStepId, 'welcome' | 'finish'>;

/**
 * Overlay host of the first-time tour. Mounted once per native layer: over the tabs, and
 * inside the full-screen pack opening modal (`scope="pack"`). Shows only the steps of its
 * scope, never blocks touches (except the welcome and summary screens, which can be skipped).
 */
export function FtueLayer({ scope }: { scope: FtueScope }) {
  const state = useFtueStore((store) => store.state);
  const dispatch = useFtueStore((store) => store.dispatch);
  const epicBanner = useFtueStore((store) => store.epicBanner);
  const hideEpicBanner = useFtueStore((store) => store.hideEpicBanner);
  const isNewPlayer = useSessionStore((session) => session.isNewPlayer);
  const celebrating = useCelebrations((celebrations) => celebrations.queue.length > 0);
  const step = currentStep(state);

  // Only brand-new accounts get the tour; players already signed in on this device skip it.
  useEffect(() => {
    if (scope !== 'tabs' || state.status !== 'notStarted') return;
    dispatch({ type: isNewPlayer ? 'start' : 'legacy' });
  }, [dispatch, isNewPlayer, scope, state.status]);

  // The pack opening screen reports its own life cycle.
  useEffect(() => {
    if (scope !== 'pack') return undefined;
    ftueEvent('packScreenOpened');
    return () => ftueEvent('packScreenClosed');
  }, [scope]);

  const showStep = step !== null && step.scope === scope && !(scope === 'tabs' && celebrating);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {showStep ? <StepView key={step.id} step={step} /> : null}
      {scope === 'pack' && epicBanner ? <EpicBanner onDone={hideEpicBanner} /> : null}
    </View>
  );
}

function StepView({ step }: { step: FtueStep }) {
  const { t } = useTranslation();
  const state = useFtueStore((store) => store.state);
  const dispatch = useFtueStore((store) => store.dispatch);
  const pathname = usePathname();
  const online = useIsOnline();
  const packs = usePacksQuery();
  const layerRef = useRef<ComponentRef<typeof View>>(null);
  const [layer, setLayer] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const windowRect = useAnchorRect(step.anchor);

  const packsLeft = packs.data ? packs.data.freePacks.stock + packs.data.bonusPacks : null;
  const autoSkip = shouldAutoSkip(step, { online, packsLeft });

  useEffect(() => {
    if (autoSkip) dispatch({ type: 'skipStep' }, online ? 'unavailable' : 'offline');
  }, [autoSkip, dispatch, online]);

  useEffect(() => {
    trackFtue({ name: 'ftue_step_viewed', step: step.id });
  }, [step.id]);

  const coachId = step.id as CoachStepId;
  const coached = !step.fullScreen;
  useEffect(() => {
    if (coached) {
      const title = t(`ftue.steps.${coachId}.title`);
      AccessibilityInfo.announceForAccessibility(t('ftue.a11y.tourStep', { ...displayedStep(state), title }));
    }
    // Announce once per step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    layerRef.current?.measureInWindow((x, y) => setLayer({ x, y, width, height }));
  }, []);

  const next = useCallback(() => dispatch({ type: 'next' }), [dispatch]);
  const skipStep = useCallback(() => dispatch({ type: 'skipStep' }), [dispatch]);
  const quit = useCallback(() => dispatch({ type: 'skipAll' }), [dispatch]);

  if (autoSkip) return null;
  if (step.id === 'welcome') return <WelcomeStep onDone={next} onQuit={quit} />;
  if (step.id === 'finish') return <FinishStep onDone={next} />;

  const target: FtueRect | null = windowRect
    ? { x: windowRect.x - layer.x, y: windowRect.y - layer.y, width: windowRect.width, height: windowRect.height }
    : null;
  const size = { width: layer.width, height: layer.height };
  const onWrongTab = step.route !== undefined && normalize(pathname) !== step.route;

  let primary: CoachAction | undefined;
  let title = t(`ftue.steps.${coachId}.title`);
  let body = t(`ftue.steps.${coachId}.body`);
  if (onWrongTab && step.route) {
    const route = step.route;
    body = title;
    title = t('ftue.goTo.title');
    primary = { label: t(GO_TO_LABEL[route]), onPress: () => router.navigate(route as Href) };
  } else if (step.id === 'playQuiz') {
    primary = {
      label: t('ftue.steps.playQuiz.cta'),
      onPress: () => {
        next();
        router.push('/quiz');
      },
    };
  } else if (step.advanceOn === 'next') {
    primary = { label: t('ftue.common.next'), onPress: next };
  }

  return (
    <View ref={layerRef} style={StyleSheet.absoluteFill} pointerEvents="box-none" onLayout={onLayout}>
      {target && !onWrongTab && size.width > 0 ? <Spotlight target={target} layer={size} /> : null}
      {step.id === 'tearPack' && target ? <BladeHint target={target} /> : null}
      {size.width > 0 ? (
        <CoachBubble
          title={title}
          body={body}
          step={displayedStep(state)}
          target={onWrongTab ? null : target}
          layer={size}
          primary={primary}
          onSkipStep={skipStep}
          onQuit={quit}
          placement={step.scope === 'pack' ? (step.id === 'tearPack' ? 'bottom' : 'top') : 'auto'}
        />
      ) : null}
    </View>
  );
}

/** "/(tabs)/collection" and "/collection" are the same tab. */
function normalize(pathname: string): string {
  const path = pathname.replace(/\/\([^)]+\)/g, '') || '/';
  return path === '/index' ? '/' : path;
}
