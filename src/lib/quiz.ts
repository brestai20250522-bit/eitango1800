import { isDue } from "./review";
import type { ProgressMap, QuizQuestion, SessionKind, Word } from "../types";

type RandomSource = () => number;

export function normalizeAnswer(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function shuffle<T>(items: T[], rng: RandomSource = Math.random): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function buildQuestion(word: Word, allWords: Word[], rng: RandomSource = Math.random): QuizQuestion {
  const correctKey = normalizeAnswer(word.japanese);
  const seen = new Set([correctKey]);
  const distractors: string[] = [];

  const eligible = allWords.filter(
    (candidate) => candidate.id !== word.id && normalizeAnswer(candidate.japanese) !== correctKey,
  );
  const sameUnit = shuffle(
    eligible.filter((candidate) => candidate.unit === word.unit),
    rng,
  );
  const otherUnits = shuffle(
    eligible.filter((candidate) => candidate.unit !== word.unit),
    rng,
  );

  for (const candidate of [...sameUnit, ...otherUnits]) {
    const key = normalizeAnswer(candidate.japanese);
    if (!seen.has(key)) {
      distractors.push(candidate.japanese);
      seen.add(key);
    }
    if (distractors.length === 3) {
      break;
    }
  }

  if (distractors.length < 3) {
    throw new Error(`Not enough unique choices for word ${word.id}`);
  }

  const options = shuffle([word.japanese, ...distractors], rng);
  return {
    id: `${word.id}-${options.join("|")}`,
    word,
    prompt: word.english,
    correctAnswer: word.japanese,
    options,
  };
}

type SelectSessionOptions = {
  kind: SessionKind;
  limit: number;
  unit?: string;
  nowMs?: number;
  rng?: RandomSource;
};

export function selectSessionWords(
  words: Word[],
  progress: ProgressMap,
  { kind, limit, unit, nowMs = Date.now(), rng = Math.random }: SelectSessionOptions,
): Word[] {
  const scopedWords = unit ? words.filter((word) => word.unit === unit) : words;

  if (kind === "test") {
    return shuffle(scopedWords, rng).slice(0, limit);
  }

  if (kind === "review") {
    return scopedWords
      .filter((word) => isDue(progress[word.id], nowMs))
      .sort((a, b) => {
        const aDue = Date.parse(progress[a.id]?.dueAt ?? "");
        const bDue = Date.parse(progress[b.id]?.dueAt ?? "");
        return aDue - bDue || a.number - b.number;
      })
      .slice(0, limit);
  }

  if (kind === "new") {
    return shuffle(
      scopedWords.filter((word) => !progress[word.id] || progress[word.id].attempts === 0),
      rng,
    ).slice(0, limit);
  }

  if (kind === "weak") {
    return scopedWords
      .filter((word) => {
        const item = progress[word.id];
        return Boolean(item && item.wrong > 0 && !item.masteredAt);
      })
      .sort((a, b) => {
        const aProgress = progress[a.id];
        const bProgress = progress[b.id];
        const aDue = isDue(aProgress, nowMs) ? 1 : 0;
        const bDue = isDue(bProgress, nowMs) ? 1 : 0;
        const aScore = (aProgress?.wrong ?? 0) - (aProgress?.correct ?? 0);
        const bScore = (bProgress?.wrong ?? 0) - (bProgress?.correct ?? 0);
        return bDue - aDue || bScore - aScore || a.number - b.number;
      })
      .slice(0, limit);
  }

  const due = scopedWords.filter((word) => isDue(progress[word.id], nowMs));
  const fresh = scopedWords.filter((word) => !progress[word.id] || progress[word.id].attempts === 0);
  const weak = scopedWords.filter((word) => {
    const item = progress[word.id];
    return Boolean(item && item.wrong > 0 && !item.masteredAt && !isDue(item, nowMs));
  });
  const remaining = scopedWords.filter(
    (word) => !due.includes(word) && !fresh.includes(word) && !weak.includes(word),
  );

  return [...due, ...shuffle(fresh, rng), ...weak, ...shuffle(remaining, rng)].slice(0, limit);
}

export function createQuizSession(
  words: Word[],
  allWords: Word[],
  rng: RandomSource = Math.random,
): QuizQuestion[] {
  return words.map((word) => buildQuestion(word, allWords, rng));
}
