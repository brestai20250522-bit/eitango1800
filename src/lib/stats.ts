import { isDue, isMastered } from "./review";
import type { ProgressMap, Word } from "../types";

export type UnitStat = {
  unit: string;
  total: number;
  attempted: number;
  mastered: number;
  due: number;
  weak: number;
};

export type AppStats = {
  total: number;
  attempted: number;
  mastered: number;
  due: number;
  weak: number;
  scheduled: number;
  accuracy: number;
  correct: number;
  attempts: number;
  units: UnitStat[];
};

export function getAppStats(words: Word[], progress: ProgressMap, nowMs = Date.now()): AppStats {
  const totals = words.reduce(
    (acc, word) => {
      const item = progress[word.id];
      acc.attempted += item && item.attempts > 0 ? 1 : 0;
      acc.mastered += isMastered(item) ? 1 : 0;
      acc.due += isDue(item, nowMs) ? 1 : 0;
      acc.weak += item && item.wrong > 0 && !item.masteredAt ? 1 : 0;
      acc.scheduled += item?.dueAt && !isDue(item, nowMs) ? 1 : 0;
      acc.correct += item?.correct ?? 0;
      acc.attempts += item?.attempts ?? 0;
      return acc;
    },
    { attempted: 0, mastered: 0, due: 0, weak: 0, scheduled: 0, correct: 0, attempts: 0 },
  );

  const unitNames = [...new Set(words.map((word) => word.unit))];
  const units = unitNames.map<UnitStat>((unit) => {
    const unitWords = words.filter((word) => word.unit === unit);
    return unitWords.reduce<UnitStat>(
      (acc, word) => {
        const item = progress[word.id];
        acc.attempted += item && item.attempts > 0 ? 1 : 0;
        acc.mastered += isMastered(item) ? 1 : 0;
        acc.due += isDue(item, nowMs) ? 1 : 0;
        acc.weak += item && item.wrong > 0 && !item.masteredAt ? 1 : 0;
        return acc;
      },
      { unit, total: unitWords.length, attempted: 0, mastered: 0, due: 0, weak: 0 },
    );
  });

  return {
    total: words.length,
    ...totals,
    accuracy: totals.attempts === 0 ? 0 : Math.round((totals.correct / totals.attempts) * 100),
    units,
  };
}
