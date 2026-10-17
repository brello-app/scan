import type { UsageRow } from "../data-normalizer";
import { addDays } from "./stats";

export type DailyMetric = "cost" | "tokens";

export type DailyPoint = {
  date: string;
  cost: number;
  /** Null when the source export doesn't include token counts. */
  tokens: number | null;
};

/** Tell usage exports from cost-only exports, which do not contain token counts. */
export function isUsageExport(row: UsageRow): boolean {
  return row.format.endsWith("_usage");
}

/** Count billable token categories represented by one normalized row. */
export function rowTokenCount(row: UsageRow): number {
  return (
    row.inputTokens +
    row.outputTokens +
    row.cacheReadTokens +
    row.cacheWriteTokens
  );
}

/** Aggregate rows by UTC day and fill missing dates without inventing token data. */
export function toDaily(rows: readonly UsageRow[]): DailyPoint[] {
  const byDate = new Map<string, DailyPoint>();
  let hasTokenData = false;
  let firstDate: string | null = null;
  let lastDate: string | null = null;

  for (const row of rows) {
    const rowHasTokens = isUsageExport(row);
    if (rowHasTokens) hasTokenData = true;
    if (firstDate === null || row.date < firstDate) firstDate = row.date;
    if (lastDate === null || row.date > lastDate) lastDate = row.date;

    const point = byDate.get(row.date) ?? {
      date: row.date,
      cost: 0,
      tokens: null,
    };

    point.cost += row.costUsd ?? 0;
    if (rowHasTokens) {
      point.tokens = (point.tokens ?? 0) + rowTokenCount(row);
    }
    byDate.set(row.date, point);
  }

  if (firstDate === null || lastDate === null) return [];
  const points: DailyPoint[] = [];

  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    points.push(
      byDate.get(date) ?? {
        date,
        cost: 0,
        tokens: hasTokenData ? 0 : null,
      },
    );
  }

  return points;
}
