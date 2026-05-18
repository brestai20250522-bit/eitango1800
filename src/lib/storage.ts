import type { ProgressMap, Word, WordProgress } from "../types";

const STORAGE_KEY = "eitango-pwa-progress-v1";
const STORAGE_VERSION = 1;

type StoredProgress = {
  version: number;
  savedAt: string;
  items: ProgressMap;
};

function isStoredProgress(value: unknown): value is StoredProgress {
  return (
    typeof value === "object" &&
    value !== null &&
    "items" in value &&
    typeof (value as { items?: unknown }).items === "object" &&
    (value as { items?: unknown }).items !== null
  );
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function pairKey(english: string, japanese: string): string {
  return `${normalizeText(english)}::${normalizeText(japanese)}`;
}

function sanitizeProgress(item: WordProgress, word: Word): WordProgress {
  return {
    ...item,
    wordId: word.id,
    wordNumber: word.number,
    english: word.english,
    japanese: word.japanese,
    attempts: Math.max(0, item.attempts ?? 0),
    correct: Math.max(0, item.correct ?? 0),
    wrong: Math.max(0, item.wrong ?? 0),
    reviewStage: Math.max(0, item.reviewStage ?? 0),
    dueAt: item.dueAt ?? null,
    lastAnsweredAt: item.lastAnsweredAt ?? null,
    masteredAt: item.masteredAt ?? null,
  };
}

export function reconcileProgress(words: Word[], savedItems: ProgressMap): ProgressMap {
  const byNumber = new Map<number, WordProgress>();
  const byPair = new Map<string, WordProgress>();

  Object.values(savedItems).forEach((item) => {
    if (Number.isFinite(item.wordNumber)) {
      byNumber.set(item.wordNumber, item);
    }
    byPair.set(pairKey(item.english, item.japanese), item);
  });

  return words.reduce<ProgressMap>((next, word) => {
    const existing = savedItems[word.id] ?? byNumber.get(word.number) ?? byPair.get(pairKey(word.english, word.japanese));
    if (existing) {
      next[word.id] = sanitizeProgress(existing, word);
    }
    return next;
  }, {});
}

export function loadProgress(words: Word[]): ProgressMap {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const items = isStoredProgress(parsed) ? parsed.items : (parsed as ProgressMap);
    return reconcileProgress(words, items ?? {});
  } catch {
    return {};
  }
}

export function saveProgress(progress: ProgressMap): void {
  if (typeof window === "undefined") {
    return;
  }

  const payload: StoredProgress = {
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    items: progress,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function resetProgress(): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
}
