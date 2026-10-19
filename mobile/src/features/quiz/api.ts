import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { packsQueryKey } from '@/features/packs/queries';
import { meQueryKey, progressionQueryKey } from '@/features/player/queries';
import { achievementsQueryKey, missionsQueryKey } from '@/features/progression/queries';
import { api, unwrap, type components } from '@/lib/api';
import { storage } from '@/lib/storage';

export type QuizSession = components['schemas']['QuizSessionResponse'];
export type QuizQuestion = components['schemas']['QuestionDto'];
export type QuizOption = components['schemas']['OptionDto'];
export type QuizAnswer = components['schemas']['AnswerResponse'];
export type QuizResult = components['schemas']['QuizResultDto'];

const ACTIVE_KEY = 'quiz.activeSession';

export const quizSessionKey = (id: string) => ['quiz', 'session', id] as const;

/** Id of the quiz in progress, kept on the device so it can be resumed. */
export const activeQuiz = {
  get: (): string | null => storage.getItem(ACTIVE_KEY),
  set: (id: string) => storage.setItem(ACTIVE_KEY, id),
  clear: () => storage.removeItem(ACTIVE_KEY),
};

/** True when a session can still be played (the server stays the judge of expiry). */
export function isResumable(session: QuizSession | undefined): boolean {
  return Boolean(
    session && session.status === 'active' && session.answeredCount < session.totalQuestions && session.lives > 0,
  );
}

export function useQuizSession(id: string | null) {
  return useQuery<QuizSession>({
    queryKey: quizSessionKey(id ?? 'none'),
    queryFn: () =>
      unwrap(api.GET('/api/v1/quiz/sessions/{sessionId}', { params: { path: { sessionId: id ?? '' } } })),
    enabled: Boolean(id),
    staleTime: 0,
    retry: false,
  });
}

export function useStartQuiz() {
  const client = useQueryClient();
  return useMutation<QuizSession, Error, void>({
    mutationFn: () => unwrap(api.POST('/api/v1/quiz/sessions')),
    onSuccess: (session) => {
      activeQuiz.set(session.id);
      client.setQueryData(quizSessionKey(session.id), session);
    },
  });
}

/** Rewards land in the wallet, XP, missions and achievements: refresh what shows them. */
export function refreshAfterGame(client: QueryClient): void {
  for (const queryKey of [progressionQueryKey, meQueryKey, missionsQueryKey, achievementsQueryKey, packsQueryKey]) {
    void client.invalidateQueries({ queryKey });
  }
}

type AnswerInput = { sessionId: string; questionIndex: number; answer: string[] };

/** Sends one answer; correctness, lives and rewards all come back from the server. */
export function useAnswerQuiz() {
  const client = useQueryClient();
  return useMutation<QuizAnswer, Error, AnswerInput>({
    mutationFn: ({ sessionId, questionIndex, answer }) =>
      unwrap(
        api.POST('/api/v1/quiz/sessions/{sessionId}/answers', {
          params: { path: { sessionId } },
          body: { questionIndex, answer },
        }),
      ),
    onSuccess: (result, { sessionId }) => {
      if (result.finished) {
        activeQuiz.clear();
        refreshAfterGame(client);
      }
      client.setQueryData<QuizSession>(quizSessionKey(sessionId), (session) =>
        session ? applyAnswer(session, result) : session,
      );
    },
  });
}

/** Session as it stands after an answer, without refetching. */
export function applyAnswer(session: QuizSession, answer: QuizAnswer): QuizSession {
  return {
    ...session,
    answeredCount: answer.answeredCount,
    correctCount: answer.correctCount,
    lives: answer.lives,
    status: answer.finished ? 'completed' : session.status,
    result: answer.result ?? session.result,
  };
}
