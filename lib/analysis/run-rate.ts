import type { UsageRow } from "../data-normalizer";
import config from "./config/analysis.json";
import type { AnalysisWarning, SpikeClassification } from "./classify";
import type { DailyPoint } from "./daily";

export type RunRateOptions = {
  recentDays?: number;
  levelShiftMinDays?: number;
  levelShiftRatio?: number;
};

export type RunRateWindow = {
  startDate: string;
  endDate: string;
  days: number;
  basis: "recent" | "level-shift";
  levelShiftStartDate: string | null;
  totalSpendUsd: number;
  suspiciousSpendUsd: number;
  adjustedSpendUsd: number;
  averageDailySpendUsd: number;
  monthlyRunRateUsd: number;
};

function suspiciousSpendByDate(
  rows: readonly UsageRow[],
  warnings: readonly AnalysisWarning[],
): Map<string, number> {
  const result = new Map<string, number>();
  const keyDates = new Map<string, Set<string>>();

  for (const warning of warnings) {
    if (warning.type === "unusual-spend") {
      for (const [date, amount] of Object.entries(warning.spendByDate)) {
        result.set(date, (result.get(date) ?? 0) + amount);
      }
      continue;
    }

    const key = JSON.stringify([warning.provider, warning.apiKeyId]);
    const dates = keyDates.get(key) ?? new Set<string>();
    for (const date of warning.dates) dates.add(date);
    keyDates.set(key, dates);
  }

  // Scan usage rows once to find the portion of each day attributed to a new key.
  for (const row of rows) {
    if (!row.apiKeyId) continue;
    const dates = keyDates.get(JSON.stringify([row.provider, row.apiKeyId]));
    if (!dates?.has(row.date)) continue;

    result.set(row.date, (result.get(row.date) ?? 0) + (row.costUsd ?? 0));
  }

  return result;
}

/** Choose one shared period for monthly projections, subtracting flagged spend. */
export function calculateRunRateWindow(
  rows: readonly UsageRow[],
  daily: readonly DailyPoint[],
  classifications: readonly SpikeClassification[],
  warnings: readonly AnalysisWarning[],
  options: RunRateOptions = {},
): RunRateWindow | null {
  if (daily.length === 0) return null;

  const recentDays = Math.max(
    1,
    Math.floor(options.recentDays ?? config.runRate.recentDays),
  );
  const levelShiftMinDays = Math.max(
    1,
    Math.floor(
      options.levelShiftMinDays ?? config.runRate.levelShiftMinDays,
    ),
  );
  const levelShiftRatio =
    options.levelShiftRatio ?? config.runRate.levelShiftRatio;
  const suspiciousByDate = suspiciousSpendByDate(rows, warnings);
  let levelShiftStartDate: string | null = null;
  const adjustedCosts = daily.map((point) =>
    Math.max(
      0,
      point.cost - Math.min(point.cost, suspiciousByDate.get(point.date) ?? 0),
    ),
  );
  const prefixSpend = new Array<number>(daily.length + 1).fill(0);
  for (let index = 0; index < adjustedCosts.length; index++) {
    prefixSpend[index + 1] = prefixSpend[index] + adjustedCosts[index];
  }
  const dailyIndexByDate = new Map(
    daily.map((point, index) => [point.date, index]),
  );

  if (daily.length >= recentDays) {
    for (const spike of classifications) {
      if (spike.metric !== "cost" || spike.assessment !== "good") continue;
      const spikeIndex = dailyIndexByDate.get(spike.date) ?? -1;
      if (spikeIndex <= 0) continue;

      const beforeDays = spikeIndex;
      const afterDays = daily.length - spikeIndex;
      if (afterDays < levelShiftMinDays) continue;

      const beforeAverage = prefixSpend[spikeIndex] / beforeDays;
      const afterAverage =
        (prefixSpend[daily.length] - prefixSpend[spikeIndex]) / afterDays;
      if (
        afterAverage > beforeAverage * levelShiftRatio &&
        (!levelShiftStartDate || spike.date > levelShiftStartDate)
      ) {
        levelShiftStartDate = spike.date;
      }
    }
  }

  const basis = levelShiftStartDate ? "level-shift" : "recent";
  const recentStartIndex = Math.max(0, daily.length - recentDays);
  const startIndex = levelShiftStartDate
    ? (dailyIndexByDate.get(levelShiftStartDate) ?? 0)
    : recentStartIndex;
  const days = daily.length - startIndex;
  let totalSpendUsd = 0;
  let suspiciousSpendUsd = 0;
  for (let index = startIndex; index < daily.length; index++) {
    const point = daily[index];
    totalSpendUsd += point.cost;
    suspiciousSpendUsd += Math.min(
      point.cost,
      suspiciousByDate.get(point.date) ?? 0,
    );
  }
  const adjustedSpendUsd = Math.max(0, totalSpendUsd - suspiciousSpendUsd);
  const averageDailySpendUsd = days > 0 ? adjustedSpendUsd / days : 0;

  return {
    startDate: daily[startIndex].date,
    endDate: daily[daily.length - 1].date,
    days,
    basis,
    levelShiftStartDate,
    totalSpendUsd,
    suspiciousSpendUsd,
    adjustedSpendUsd,
    averageDailySpendUsd,
    monthlyRunRateUsd: averageDailySpendUsd * 30,
  };
}
