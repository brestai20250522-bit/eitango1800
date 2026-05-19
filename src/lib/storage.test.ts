import { describe, expect, it } from "vitest";
import { reconcileProgress, reconcileTrainingMenus } from "./storage";
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

describe("training menu reconciliation", () => {
  const words = [
    { id: "word-1", number: 1, unit: "まとめて①", english: "white", japanese: "白" },
    { id: "word-2", number: 2, unit: "まとめて①", english: "twenty", japanese: "20" },
  ];

  it("keeps three menus and removes word ids that no longer exist", () => {
    const menus = reconcileTrainingMenus(words, [
      { id: "menu-a", name: "苦手まとめ", wordIds: ["word-1", "missing", "word-1"], updatedAt: "2026-01-01T00:00:00.000Z" },
    ]);

    expect(menus).toHaveLength(3);
    expect(menus[0]).toMatchObject({
      id: "menu-a",
      name: "苦手まとめ",
      wordIds: ["word-1"],
    });
    expect(menus[1]).toMatchObject({ id: "menu-b", name: "メニューB", wordIds: [] });
    expect(menus[2]).toMatchObject({ id: "menu-c", name: "メニューC", wordIds: [] });
  });
});
