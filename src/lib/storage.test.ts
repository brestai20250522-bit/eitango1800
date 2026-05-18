import { describe, expect, it } from "vitest";
import { reconcileProgress } from "./storage";
import type { ProgressMap, WordProgress } from "../types";

const saved: WordProgress = {
  wordId: "old-id",
  wordNumber: 12,
  english: "orange",
  japanese: "オレンジ",
  attempts: 3,
  correct: 2,
  wrong: 1,
  reviewStage: 1,
  dueAt: "2026-01-02T00:00:00.000Z",
  lastAnsweredAt: "2026-01-01T00:00:00.000Z",
  masteredAt: null,
};

describe("progress reconciliation", () => {
  it("keeps progress when the word number still matches", () => {
    const words = [{ id: "word-12", number: 12, unit: "まとめて①", english: "orange", japanese: "オレンジ" }];
    const result = reconcileProgress(words, { "old-id": saved });

    expect(result["word-12"]).toMatchObject({
      wordId: "word-12",
      wordNumber: 12,
      attempts: 3,
      wrong: 1,
    });
  });

  it("falls back to the English and Japanese pair", () => {
    const words = [{ id: "word-99", number: 99, unit: "まとめて①", english: "orange", japanese: "オレンジ" }];
    const result = reconcileProgress(words, { "old-id": { ...saved, wordNumber: 12 } as WordProgress } as ProgressMap);

    expect(result["word-99"]).toMatchObject({
      wordId: "word-99",
      wordNumber: 99,
      attempts: 3,
      correct: 2,
    });
  });
});
