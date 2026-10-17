"use client";

import { useMemo } from "react";
import { analyze, type Analysis } from "@/lib/analysis";
import type { UsageRow } from "@/lib/data-normalizer";
import useDataStore from "@/lib/store/data-store";

const analysisByRows = new WeakMap<readonly UsageRow[], Analysis>();

function analyzeOnce(rows: readonly UsageRow[]): Analysis {
  const cached = analysisByRows.get(rows);
  if (cached) return cached;

  const result = analyze(rows);
  analysisByRows.set(rows, result);
  return result;
}

/** Share the pure analysis result between the chart, KPI, alerts, and advice UI. */
export function useAnalysis(): Analysis {
  const rows = useDataStore((state) => state.rows);
  return useMemo(() => analyzeOnce(rows), [rows]);
}
