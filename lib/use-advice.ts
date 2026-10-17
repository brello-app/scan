"use client";

import { useMemo } from "react";
import { buildAdvice } from "@/lib/analysis/advice/run";
import type { AdviceResult } from "@/lib/analysis/advice/types";
import type { Analysis } from "@/lib/analysis";
import type { UsageRow } from "@/lib/data-normalizer";
import useDataStore from "@/lib/store/data-store";
import { useAnalysis } from "./use-analysis";

type AdviceSummary = {
  startDate: string;
  endDate: string;
  days: number;
  basis: "recent" | "level-shift";
  monthlyRunRateUsd: number;
  result: AdviceResult;
} | null;

const adviceByRows = new WeakMap<readonly UsageRow[], AdviceSummary>();

function buildAdviceSummary(
  rows: readonly UsageRow[],
  analysis: Analysis,
): AdviceSummary {
  if (adviceByRows.has(rows)) return adviceByRows.get(rows) ?? null;

  const window = analysis.runRateWindow;
  if (!window || rows.length === 0) {
    adviceByRows.set(rows, null);
    return null;
  }

  const isInWindow = (date: string) =>
    date >= window.startDate && date <= window.endDate;
  const windowRows = rows.filter((row) => isInWindow(row.date));
  const warnings = analysis.warnings.filter((warning) =>
    warning.dates.some(isInWindow),
  );
  const excludeKeyIds = warnings.flatMap((warning) =>
    warning.type === "unfamiliar-api-key" ? [warning.apiKeyId] : [],
  );
  const excludeDates = new Set(warnings.flatMap((warning) => warning.dates));
  const result = buildAdvice(windowRows, {
    excludeKeyIds,
    excludeDates,
    windowDays: window.days,
    runRateMonthlyUsd: window.monthlyRunRateUsd,
  });
  const summary: AdviceSummary = {
    startDate: window.startDate,
    endDate: window.endDate,
    days: window.days,
    basis: window.basis,
    monthlyRunRateUsd: window.monthlyRunRateUsd,
    result,
  };
  adviceByRows.set(rows, summary);
  return summary;
}

/** Share advice recommendations and their total between the report UI sections. */
export function useAdvice(): AdviceSummary {
  const rows = useDataStore((state) => state.rows);
  const analysis = useAnalysis();
  return useMemo(() => buildAdviceSummary(rows, analysis), [rows, analysis]);
}
