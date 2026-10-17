"use client";

import useDataStore from "@/lib/store/data-store";
import { KPICard } from "@/components/ui/kpi";
import { useAnalysis } from "../../lib/use-analysis";
import { useAdvice } from "../../lib/use-advice";

function formatDollars(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatRunRateCaption(
  window: ReturnType<typeof useAnalysis>["runRateWindow"],
): string | undefined {
  if (!window) return undefined;

  const days = `${window.days} ${window.days === 1 ? "day" : "days"}`;
  if (window.basis === "level-shift") {
    const formatDate = (date: string) =>
      new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      }).format(new Date(date + "T00:00:00.000Z"));
    return `Based on ${formatDate(window.startDate)} – ${formatDate(window.endDate)} (${days}) · suspicious spend excluded`;
  }

  if (window.days === 14) {
    return "Last 14 days \n excluding suspicious spend";
  }
  return `Based on ${days} \n excluding suspicious spend`;
}

export function ResultKPIs() {
  const rows = useDataStore((state) => state.rows);
  const analysis = useAnalysis();
  const advice = useAdvice();
  const hasCostData = rows.some((row) => row.costUsd !== null);

  const totalSpent = rows.reduce((sum, row) => sum + (row.costUsd ?? 0), 0);
  const suspiciousSpend = analysis.warnings.reduce(
    (sum, warning) => sum + warning.amountUsd,
    0,
  );
  const runRateWindow = analysis.runRateWindow;
  const noCostLabel = rows.length === 0 || !hasCostData ? "—" : null;

  return (
    <div className="flex py-5">
      <KPICard
        className="flex-1"
        number={noCostLabel ?? formatDollars(totalSpent)}
        description="Total spent"
      />
      <KPICard
        className="flex-1"
        number={noCostLabel ?? formatDollars(suspiciousSpend)}
        description="Suspicious spend"
        warn={suspiciousSpend > 0}
      />
      <KPICard
        className="flex-1"
        number={
          noCostLabel ??
          (runRateWindow === null
            ? "—"
            : formatDollars(runRateWindow.monthlyRunRateUsd))
        }
        unit={noCostLabel || runRateWindow === null ? undefined : "/mo"}
        description="Normal run-rate"
        caption={formatRunRateCaption(runRateWindow)}
      />
      <KPICard
        className="flex-1"
        number={
          noCostLabel ??
          (advice?.result
            ? formatDollars(advice.result.totalMonthlySavingsUsd) + "~"
            : "—")
        }
        unit={noCostLabel || !advice?.result ? undefined : "/mo"}
        description="You could save"
        caption={advice?.result ? "Ways to Save only" : undefined}
      />
    </div>
  );
}
