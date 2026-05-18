import { describe, expect, it } from "vitest";
import { applyAnswer, REVIEW_INTERVALS_MS } from "./review";
import type { ProgressMap, Word } from "../types";

const word: Word = {
  id: "word-1",
  number: 1,
  unit: "まとめて①",
  english: "white",
  japanese: "白",
};

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

describe("review scheduling", () => {
  it("schedules a wrong answer after ten minutes", () => {
    const now = Date.UTC(2026, 0, 1, 9, 0, 0);
    const progress = applyAnswer({}, word, false, now);

    expect(progress[word.id]).toMatchObject({
      attempts: 1,
      correct: 0,
      wrong: 1,
      reviewStage: 0,
      dueAt: iso(now + REVIEW_INTERVALS_MS[0]),
      masteredAt: null,
    });
  });

  it("advances the short review ladder and marks the word mastered", () => {
    const start = Date.UTC(2026, 0, 1, 9, 0, 0);
    let progress: ProgressMap = {};

    progress = applyAnswer(progress, word, false, start);
    progress = applyAnswer(progress, word, true, start + REVIEW_INTERVALS_MS[0]);
    expect(progress[word.id].reviewStage).toBe(1);
    expect(progress[word.id].dueAt).toBe(iso(start + REVIEW_INTERVALS_MS[0] + REVIEW_INTERVALS_MS[1]));

    const secondReview = Date.parse(progress[word.id].dueAt!);
    progress = applyAnswer(progress, word, true, secondReview);
    expect(progress[word.id].reviewStage).toBe(2);
    expect(progress[word.id].dueAt).toBe(iso(secondReview + REVIEW_INTERVALS_MS[2]));

    const thirdReview = Date.parse(progress[word.id].dueAt!);
    progress = applyAnswer(progress, word, true, thirdReview);
    expect(progress[word.id].reviewStage).toBe(3);
    expect(progress[word.id].dueAt).toBe(iso(thirdReview + REVIEW_INTERVALS_MS[3]));

    const finalReview = Date.parse(progress[word.id].dueAt!);
    progress = applyAnswer(progress, word, true, finalReview);
    expect(progress[word.id].reviewStage).toBe(4);
    expect(progress[word.id].dueAt).toBeNull();
    expect(progress[word.id].masteredAt).toBe(iso(finalReview));
  });

  it("resets to ten minutes after a repeat mistake", () => {
    const start = Date.UTC(2026, 0, 1, 9, 0, 0);
    let progress: ProgressMap = {};

    progress = applyAnswer(progress, word, false, start);
    progress = applyAnswer(progress, word, true, start + REVIEW_INTERVALS_MS[0]);
    const repeatMistake = start + REVIEW_INTERVALS_MS[0] + 5_000;
    progress = applyAnswer(progress, word, false, repeatMistake);

    expect(progress[word.id].reviewStage).toBe(0);
    expect(progress[word.id].dueAt).toBe(iso(repeatMistake + REVIEW_INTERVALS_MS[0]));
    expect(progress[word.id].masteredAt).toBeNull();
  });
});
