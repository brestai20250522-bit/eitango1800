import type { ProgressMap, Word, WordProgress } from "../types";

export const REVIEW_INTERVALS_MS = [
  10 * 60 * 1000,
  24 * 60 * 60 * 1000,
  3 * 24 * 60 * 60 * 1000,
  7 * 24 * 60 * 60 * 1000,
] as const;

export function createWordProgress(word: Word): WordProgress {
  return {
    wordId: word.id,
    wordNumber: word.number,
    english: word.english,
    japanese: word.japanese,
    attempts: 0,
    correct: 0,
    wrong: 0,
    reviewStage: 0,
    dueAt: null,
    lastAnsweredAt: null,
    masteredAt: null,
  };
}

export function applyAnswerToProgress(
  current: WordProgress | undefined,
  word: Word,
  isCorrect: boolean,
  nowMs = Date.now(),
): WordProgress {
  const base = current ?? createWordProgress(word);
  const answeredAt = new Date(nowMs).toISOString();
  const nextBase: WordProgress = {
    ...base,
    wordId: word.id,
    wordNumber: word.number,
    english: word.english,
    japanese: word.japanese,
    attempts: base.attempts + 1,
    correct: base.correct + (isCorrect ? 1 : 0),
    wrong: base.wrong + (isCorrect ? 0 : 1),
    lastAnsweredAt: answeredAt,
  };

  if (!isCorrect) {
    return {
      ...nextBase,
      reviewStage: 0,
      dueAt: new Date(nowMs + REVIEW_INTERVALS_MS[0]).toISOString(),
      masteredAt: null,
    };
  }

  if (base.wrong === 0 && !base.dueAt) {
    return {
      ...nextBase,
      dueAt: null,
      masteredAt: base.masteredAt,
    };
  }

  const nextStage = base.reviewStage + 1;
  if (nextStage >= REVIEW_INTERVALS_MS.length) {
    return {
      ...nextBase,
      reviewStage: nextStage,
      dueAt: null,
      masteredAt: answeredAt,
    };
  }

  return {
    ...nextBase,
    reviewStage: nextStage,
    dueAt: new Date(nowMs + REVIEW_INTERVALS_MS[nextStage]).toISOString(),
    masteredAt: null,
  };
}

export function applyAnswer(
  progress: ProgressMap,
  word: Word,
  isCorrect: boolean,
  nowMs = Date.now(),
): ProgressMap {
  return {
    ...progress,
    [word.id]: applyAnswerToProgress(progress[word.id], word, isCorrect, nowMs),
  };
}

export function isDue(progress: WordProgress | undefined, nowMs = Date.now()): boolean {
  if (!progress?.dueAt) {
    return false;
  }
  return Date.parse(progress.dueAt) <= nowMs;
}

export function isMastered(progress: WordProgress | undefined): boolean {
  if (!progress) {
    return false;
  }
  return Boolean(progress.masteredAt) || (progress.correct > 0 && !progress.dueAt);
}
