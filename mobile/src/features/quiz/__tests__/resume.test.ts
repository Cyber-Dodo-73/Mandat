import type { QuizAnswer, QuizSession } from '../api';
import { applyAnswer, isResumable } from '../api';

// progression queries pull expo-audio in through lib/sounds.
jest.mock('@/lib/sounds', () => ({ playSound: jest.fn() }));

const session = (overrides: Partial<QuizSession>): QuizSession => ({
  id: 'q1',
  answeredCount: 3,
  correctCount: 2,
  expiresAt: '2026-10-19T12:30:00.123456789Z',
  lives: 2,
  questions: [],
  status: 'active',
  totalQuestions: 10,
  ...overrides,
});

describe('quiz resume', () => {
  it('resumes an active session with lives and questions left', () => {
    expect(isResumable(session({}))).toBe(true);
  });

  it('does not resume finished, expired or lost sessions', () => {
    expect(isResumable(session({ status: 'completed' }))).toBe(false);
    expect(isResumable(session({ status: 'expired' }))).toBe(false);
    expect(isResumable(session({ lives: 0 }))).toBe(false);
    expect(isResumable(session({ answeredCount: 10 }))).toBe(false);
    expect(isResumable(undefined)).toBe(false);
  });

  it('applies the server answer without recomputing anything', () => {
    const answer: QuizAnswer = {
      questionIndex: 3,
      answeredCount: 4,
      correct: false,
      correctAnswer: ['FR'],
      correctCount: 2,
      explanation: '',
      finished: true,
      lives: 0,
      result: { bonusPack: false, correctAnswers: 2, influence: 4, perfect: false, rewardCapped: false, totalQuestions: 10 },
    };
    const next = applyAnswer(session({}), answer);
    expect(next).toMatchObject({ answeredCount: 4, lives: 0, status: 'completed', correctCount: 2 });
    expect(next.result?.influence).toBe(4);
    expect(isResumable(next)).toBe(false);
  });
});
