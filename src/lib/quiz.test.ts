import { describe, expect, it } from "vitest";
import wordsJson from "../data/words.json";
import { buildQuestion, selectSessionWords } from "./quiz";
import { applyAnswer } from "./review";
import type { ProgressMap, Word } from "../types";

const words = wordsJson as Word[];
const stableRng = () => 0.42;

describe("imported word data", () => {
  it("contains the valid Excel rows and skips blank trailing rows", () => {
    expect(words).toHaveLength(1600);
    expect(new Set(words.map((word) => word.unit))).toHaveLength(23);
    expect(words.every((word) => typeof word.japanese === "string")).toBe(true);
    expect(words.find((word) => word.number === 2)?.japanese).toBe("20");
  });

  it("keeps duplicate English spellings as separate numbered words", () => {
    const march = words.filter((word) => word.english.toLowerCase() === "march");
    const like = words.filter((word) => word.english.toLowerCase() === "like");

    expect(march.map((word) => word.number).sort((a, b) => a - b)).toEqual([22, 1049]);
    expect(like.map((word) => word.number).sort((a, b) => a - b)).toEqual([258, 483]);
  });
});

describe("quiz question generation", () => {
  it("builds four unique choices including exactly one correct answer", () => {
    const question = buildQuestion(words[0], words, stableRng);

    expect(question.prompt).toBe(words[0].english);
    expect(question.correctAnswer).toBe(words[0].japanese);
    expect(question.options).toHaveLength(4);
    expect(new Set(question.options)).toHaveLength(4);
    expect(question.options.filter((option) => option === words[0].japanese)).toHaveLength(1);
  });

  it("selects due review words only after their due time", () => {
    const base = Date.UTC(2026, 0, 1, 9, 0, 0);
    const progress = applyAnswer({}, words[0], false, base);

    expect(selectSessionWords(words, progress, { kind: "review", limit: 10, nowMs: base + 9 * 60 * 1000 })).toEqual([]);
    expect(selectSessionWords(words, progress, { kind: "review", limit: 10, nowMs: base + 10 * 60 * 1000 })).toEqual([
      words[0],
    ]);
  });

  it("prioritizes weak words by unresolved mistakes", () => {
    const base = Date.UTC(2026, 0, 1, 9, 0, 0);
    let progress: ProgressMap = {};
    progress = applyAnswer(progress, words[3], false, base);
    progress = applyAnswer(progress, words[4], false, base);
    progress = applyAnswer(progress, words[4], false, base + 1_000);

    const weak = selectSessionWords(words, progress, { kind: "weak", limit: 2, nowMs: base, rng: stableRng });

    expect(weak.map((word) => word.id)).toEqual([words[4].id, words[3].id]);
  });

  it("can select every word in one unit when the limit is larger than the unit", () => {
    const unit = "まとめて①";
    const unitWords = words.filter((word) => word.unit === unit);
    const selected = selectSessionWords(words, {}, { kind: "unit", unit, limit: words.length, rng: stableRng });

    expect(selected).toHaveLength(unitWords.length);
    expect(selected.every((word) => word.unit === unit)).toBe(true);
  });

  it("selects random test words from the requested scope", () => {
    const unit = "10級";
    const selected = selectSessionWords(words, {}, { kind: "test", unit, limit: 20, rng: stableRng });

    expect(selected).toHaveLength(20);
    expect(selected.every((word) => word.unit === unit)).toBe(true);
  });
});
