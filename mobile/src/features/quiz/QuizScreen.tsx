import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { Body, Button3D, Caption, Heading, Icon, PressableScale, ProgressBar, Text } from '@/components/ui';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { ApiError, describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { radius, spacing, useTheme } from '@/theme';

import {
  activeQuiz,
  isResumable,
  useAnswerQuiz,
  useQuizSession,
  useStartQuiz,
  type QuizAnswer,
  type QuizQuestion,
  type QuizSession,
} from './api';
import { OptionFigure } from './OptionFigure';
import { OrderQuestion } from './OrderQuestion';
import { QuizEnd } from './QuizEnd';

const MAX_LIVES = 3;
const SESSION_GONE = new Set(['quiz_session_finished', 'quiz_session_expired', 'not_found']);

type Feedback = { answer: QuizAnswer; chosen: string[] };

/** Duolingo-style quiz: the server writes the questions and judges every answer. */
export function QuizScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useIsOnline();
  const [sessionId, setSessionId] = useState<string | null>(() => activeQuiz.get());
  const session = useQuizSession(sessionId);
  const start = useStartQuiz();
  const startedOnce = useRef(false);

  // Resume the stored session when it is still playable, otherwise start a fresh one.
  useEffect(() => {
    if (startedOnce.current || start.isPending || !online) return;
    const stored = Boolean(sessionId);
    const gone = session.error instanceof ApiError && SESSION_GONE.has(session.error.code);
    if (!stored || gone || (session.data && session.data.status !== 'active')) {
      startedOnce.current = true;
      activeQuiz.clear();
      start.mutate(undefined, { onSuccess: (fresh) => setSessionId(fresh.id) });
    }
  }, [online, session.data, session.error, sessionId, start]);

  const restart = () => {
    activeQuiz.clear();
    startedOnce.current = true;
    start.mutate(undefined, { onSuccess: (fresh) => setSessionId(fresh.id) });
  };

  const data = session.data;
  const failure = start.error ?? (session.error && !(session.error instanceof ApiError) ? session.error : null);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xs }]}>
      {!online && !data ? (
        <View style={styles.centered}>
          <OfflineNotice message={t('quiz.offline')} />
          <Button3D label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        </View>
      ) : failure ? (
        <View style={styles.centered}>
          <Body align="center">{describeError(failure, t)}</Body>
          <Button3D label={t('common.retry')} onPress={restart} />
        </View>
      ) : !data || (start.isPending && data.id !== sessionId) ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.textMuted} />
          <Caption tone="muted">{t('quiz.preparing')}</Caption>
        </View>
      ) : (
        <QuizPlay key={data.id} session={data} onRestart={restart} bottomInset={insets.bottom} />
      )}
    </View>
  );
}

type QuizPlayProps = { session: QuizSession; onRestart: () => void; bottomInset: number };

function QuizPlay({ session, onRestart, bottomInset }: QuizPlayProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const answer = useAnswerQuiz();
  const [cursor, setCursor] = useState(session.answeredCount);
  const [selection, setSelection] = useState<string[]>(() => defaultSelection(questionAt(session, session.answeredCount)));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  const question = questionAt(session, cursor);
  const finished = (session.status !== 'active' || !isResumable(session)) && !feedback;

  if (finished && session.result) {
    return <QuizEnd result={session.result} onRetry={onRestart} />;
  }
  if (!question) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.textMuted} />
      </View>
    );
  }

  const isOrder = question.type === 'chronology';
  const canSubmit = !feedback && !answer.isPending && (isOrder ? selection.length > 0 : selection.length === 1);

  const submit = () => {
    if (!canSubmit) return;
    haptics.tap();
    setError(null);
    answer.mutate(
      { sessionId: session.id, questionIndex: question.index, answer: selection },
      {
        onSuccess: (result) => {
          setFeedback({ answer: result, chosen: selection });
          if (result.correct) {
            haptics.missionComplete();
            playSound('answer_correct');
          } else {
            haptics.error();
            playSound('answer_wrong');
          }
        },
        onError: (cause) => setError(describeError(cause, t)),
      },
    );
  };

  const next = () => {
    haptics.tap();
    setFeedback(null);
    setSelection(defaultSelection(questionAt(session, cursor + 1)));
    setCursor(cursor + 1);
  };

  const lives = feedback ? feedback.answer.lives : session.lives;
  const answered = feedback ? feedback.answer.answeredCount : cursor;
  const correctIds = feedback ? new Set(feedback.answer.correctAnswer) : null;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('quiz.quit')}
          hitSlop={12}
          onPress={() => router.back()}
        >
          <Icon name="close" size={28} tone="textMuted" />
        </PressableScale>
        <View style={styles.progress}>
          <ProgressBar
            progress={answered / session.totalQuestions}
            color={colors.success}
            accessibilityLabel={t('quiz.progressA11y', { current: answered, total: session.totalQuestions })}
          />
        </View>
        <View
          style={styles.hearts}
          accessible
          accessibilityLabel={t('quiz.livesA11y', { count: lives })}
        >
          {Array.from({ length: MAX_LIVES }, (_, index) => (
            <Icon key={index} name={index < lives ? 'heart' : 'heart-outline'} size={22} tone={index < lives ? 'danger' : 'textMuted'} />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Animated.View key={question.index} entering={reduceMotion ? undefined : FadeIn.duration(220)} style={styles.question}>
          <Caption tone="muted">{t(`quiz.type.${question.type}`)}</Caption>
          <Heading>{question.prompt}</Heading>
          {question.text ? (
            <View style={[styles.quote, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Body>{question.text}</Body>
            </View>
          ) : null}
        </Animated.View>

        {isOrder ? (
          <View style={styles.answers}>
            <Caption tone="muted">{t('quiz.order.hint')}</Caption>
            <OrderQuestion
              options={question.options}
              order={selection}
              onChange={setSelection}
              locked={Boolean(feedback)}
              correctOrder={feedback?.answer.correctAnswer}
            />
          </View>
        ) : (
          <View style={styles.answers}>
            {question.options.map((option) => {
              const selected = selection[0] === option.id;
              const isCorrect = correctIds?.has(option.id) ?? false;
              const wasWrongPick = Boolean(feedback) && feedback?.chosen[0] === option.id && !isCorrect;
              const borderColor = isCorrect
                ? colors.success
                : wasWrongPick
                  ? colors.danger
                  : selected
                    ? colors.accent
                    : colors.border;
              return (
                <PressableScale
                  key={option.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled: Boolean(feedback) }}
                  accessibilityLabel={option.label}
                  disabled={Boolean(feedback)}
                  haptic="toggle"
                  onPress={() => setSelection([option.id])}
                  style={[
                    styles.option,
                    { borderColor, backgroundColor: selected && !feedback ? colors.surfaceRaised : colors.surface },
                  ]}
                >
                  <OptionFigure option={option} />
                  <Text variant="bodyStrong" style={styles.optionLabel}>
                    {option.label}
                  </Text>
                  {isCorrect ? <Icon name="checkmark-circle" size={22} tone="success" /> : null}
                  {wasWrongPick ? <Icon name="close-circle" size={22} tone="danger" /> : null}
                </PressableScale>
              );
            })}
          </View>
        )}
        {error ? <Body tone="danger">{error}</Body> : null}
      </ScrollView>

      {feedback ? (
        <Animated.View
          entering={reduceMotion ? undefined : SlideInDown.springify().damping(18)}
          style={[
            styles.feedback,
            {
              paddingBottom: bottomInset + spacing.md,
              backgroundColor: colors.surfaceRaised,
              borderTopColor: feedback.answer.correct ? colors.success : colors.danger,
            },
          ]}
        >
          <View style={styles.feedbackTitle}>
            <Icon
              name={feedback.answer.correct ? 'checkmark-circle' : 'close-circle'}
              size={28}
              tone={feedback.answer.correct ? 'success' : 'danger'}
            />
            <Heading tone={feedback.answer.correct ? 'success' : 'danger'}>
              {feedback.answer.correct ? t('quiz.feedback.correct') : t('quiz.feedback.wrong')}
            </Heading>
          </View>
          {feedback.answer.explanation ? <Body>{feedback.answer.explanation}</Body> : null}
          <Button3D
            label={feedback.answer.finished ? t('quiz.seeResults') : t('quiz.continue')}
            variant={feedback.answer.correct ? 'primary' : 'danger'}
            fullWidth
            onPress={next}
          />
        </Animated.View>
      ) : (
        <View style={[styles.footer, { paddingBottom: bottomInset + spacing.md }]}>
          <Button3D
            label={t('quiz.check')}
            fullWidth
            size="lg"
            disabled={!canSubmit}
            loading={answer.isPending}
            onPress={submit}
          />
        </View>
      )}
    </View>
  );
}

function questionAt(session: QuizSession, index: number): QuizQuestion | undefined {
  return session.questions.find((item) => item.index === index);
}

/** The chronology question starts in the order the server sent the options; others start empty. */
function defaultSelection(question: QuizQuestion | undefined): string[] {
  return question?.type === 'chronology' ? question.options.map((option) => option.id) : [];
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  progress: { flex: 1 },
  hearts: { flexDirection: 'row', gap: 2 },
  body: { padding: spacing.md, gap: spacing.lg, paddingBottom: spacing.xxl },
  question: { gap: spacing.xs },
  quote: { borderWidth: 1, borderRadius: radius, padding: spacing.md },
  answers: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius,
    borderWidth: 2,
  },
  optionLabel: { flex: 1 },
  footer: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  feedback: { gap: spacing.sm, paddingHorizontal: spacing.md, paddingTop: spacing.md, borderTopWidth: 3 },
  feedbackTitle: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
