export type Word = {
  id: string;
  number: number;
  unit: string;
  english: string;
  japanese: string;
};

export type WordProgress = {
  wordId: string;
  wordNumber: number;
  english: string;
  japanese: string;
  attempts: number;
  correct: number;
  wrong: number;
  reviewStage: number;
  dueAt: string | null;
  lastAnsweredAt: string | null;
  masteredAt: string | null;
};

export type ProgressMap = Record<string, WordProgress>;

export type QuizQuestion = {
  id: string;
  word: Word;
  prompt: string;
  correctAnswer: string;
  options: string[];
};

export type SessionKind = "review" | "new" | "weak" | "unit";
