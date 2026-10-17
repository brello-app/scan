import type { UsageRow } from "../data-normalizer";
import config from "./config/analysis.json";
import {
  analysisSeriesKey,
  classifySpikes,
  classifyWarnings,
  type AnalysisWarning,
  type ClassificationOptions,
  type SpikeClassification,
} from "./classify";
import {
  isUsageExport,
  rowTokenCount,
  toDaily,
  type DailyMetric,
  type DailyPoint,
} from "./daily";
import {
  markSpikes,
  type DetectedSpike,
  type SpikeDetectionOptions,
} from "./spikes";
import {
  calculateRunRateWindow,
  type RunRateOptions,
  type RunRateWindow,
} from "./run-rate";
import { median, robustStd } from "./stats";

export type AnalysisOptions = {
  metric?: DailyMetric;
  spikes?: Omit<SpikeDetectionOptions<DailyMetric>, "metric"> & {
    seriesRatio?: number;
    seriesMinShareOfDay?: number;
  };
  classification?: ClassificationOptions;
  runRate?: RunRateOptions;
};

export type AnalysisDailyPoint = DailyPoint & {
  spike: "good" | "bad" | null;
  spikeRatio: number | null;
  classification: SpikeClassification | null;
};

export type Analysis = {
  daily: AnalysisDailyPoint[];
  spikes: DetectedSpike<DailyMetric>[];
  classifications: SpikeClassification[];
  warnings: AnalysisWarning[];
  runRateWindow: RunRateWindow | null;
};

export type {
  AnalysisWarning,
  ClassificationDriver,
  ClassificationOptions,
  SeriesIdentity,
  SpikeClassification,
} from "./classify";
export type { DailyMetric, DailyPoint } from "./daily";
export type { DetectedSpike } from "./spikes";
export type { RunRateOptions, RunRateWindow } from "./run-rate";

type GroupedSpike = {
  seriesKey: string;
  candidate: DetectedSpike<"value">;
  increase: number;
};

/** Detect a runaway series even when the overall day does not spike. */
function markSeriesSpikes(
  rows: readonly UsageRow[],
  daily: readonly DailyPoint[],
  metric: DailyMetric,
  options: AnalysisOptions["spikes"],
): DetectedSpike<DailyMetric>[] {
  if (daily.length === 0) return [];

  const indexByDate = new Map(
    daily.map((point, index) => [point.date, index]),
  );
  const valuesBySeries = new Map<string, number[]>();

  for (const row of rows) {
    if (metric === "tokens" && !isUsageExport(row)) continue;
    const index = indexByDate.get(row.date);
    if (index === undefined) continue;

    const key = analysisSeriesKey(row);
    const values = valuesBySeries.get(key) ?? new Array(daily.length).fill(0);
    values[index] += metric === "cost" ? row.costUsd ?? 0 : rowTokenCount(row);
    valuesBySeries.set(key, values);
  }

  const groupedSpikes: GroupedSpike[] = [];
  const seriesRatio = options?.seriesRatio ?? config.detection.seriesRatio;
  const seriesMinShareOfDay =
    options?.seriesMinShareOfDay ?? config.detection.seriesMinShareOfDay;

  for (const [seriesKey, values] of valuesBySeries) {
    const points = daily.map((point, index) => ({
      date: point.date,
      value: values[index],
    }));
    const candidates = markSpikes(points, {
      metric: "value",
      window: options?.window,
      minHistory: options?.minHistory,
      ratio: seriesRatio,
      zScore: options?.zScore,
      minValue: 0,
    });

    for (const candidate of candidates) {
      const history = daily
        .slice(candidate.historyStartIndex, candidate.historyEndIndexExclusive)
        .map((point) => point[metric] ?? 0);
      const dailyBaseline = median(history);
      const requiredIncrease = Math.max(
        metric === "cost" ? config.detection.floorUsd : 0,
        dailyBaseline * seriesMinShareOfDay,
      );
      const seriesIncrease = candidate.value - candidate.baseline;
      if (seriesIncrease < requiredIncrease) continue;

      groupedSpikes.push({ seriesKey, candidate, increase: seriesIncrease });
    }
  }

  // Keep only the strongest series trigger per day; the classifier still inspects
  // every series to identify all material causes behind that day's change.
  const strongestByDate = new Map<string, GroupedSpike>();
  for (const candidate of groupedSpikes) {
    const current = strongestByDate.get(candidate.candidate.date);
    if (!current || candidate.increase > current.increase) {
      strongestByDate.set(candidate.candidate.date, candidate);
    }
  }

  return [...strongestByDate.values()].map(({ seriesKey, candidate }) => {
    const point = daily[candidate.index];
    const historyStartIndex = candidate.historyStartIndex;
    const historyEndIndexExclusive = candidate.historyEndIndexExclusive;
    const history = daily
      .slice(historyStartIndex, historyEndIndexExclusive)
      .map((item) => item[metric] ?? 0);
    const baseline = median(history);
    const value = point[metric] ?? 0;
    const spread = robustStd(history, baseline);

    return {
      date: candidate.date,
      index: candidate.index,
      metric,
      value,
      baseline,
      robustZScore: spread === 0 ? null : (value - baseline) / spread,
      ratio: baseline === 0 ? null : value / baseline,
      historyStartIndex,
      historyEndIndexExclusive,
      historySize: history.length,
      trigger: "series",
      seriesKey,
      triggerValue: candidate.value,
      triggerBaseline: candidate.baseline,
    };
  });
}

/** The public entry point for aggregating, detecting, and describing usage changes. */
export function analyze(
  rows: readonly UsageRow[],
  options: AnalysisOptions = {},
): Analysis {
  const daily = toDaily(rows);
  const metric = options.metric ?? "cost";
  const aggregateSpikes = markSpikes(daily, {
    metric,
    window: options.spikes?.window,
    minHistory: options.spikes?.minHistory,
    ratio: options.spikes?.ratio,
    zScore: options.spikes?.zScore,
    minValue:
      options.spikes?.minValue ??
      (metric === "cost" ? config.detection.floorUsd : 0),
  });
  const aggregateDates = new Set(aggregateSpikes.map((spike) => spike.date));
  const seriesSpikes = markSeriesSpikes(rows, daily, metric, options.spikes).filter(
    (spike) => !aggregateDates.has(spike.date),
  );
  const spikes = [...aggregateSpikes, ...seriesSpikes].sort(
    (left, right) => left.index - right.index,
  );
  const classifications = classifySpikes(
    rows,
    daily,
    spikes,
    options.classification,
  );
  const warnings = classifyWarnings(rows, classifications);
  const spikesByDate = new Map(spikes.map((spike) => [spike.date, spike]));
  const classificationsByDate = new Map(
    classifications.map((classification) => [
      classification.date,
      classification,
    ]),
  );
  const analyzedDaily = daily.map((point) => {
    const detectedSpike = spikesByDate.get(point.date) ?? null;
    const classification = classificationsByDate.get(point.date) ?? null;

    return {
      ...point,
      spike: detectedSpike ? classification?.assessment ?? "bad" : null,
      spikeRatio: detectedSpike?.ratio ?? null,
      classification,
    };
  });
  const runRateWindow = calculateRunRateWindow(
    rows,
    daily,
    classifications,
    warnings,
    options.runRate,
  );

  return {
    daily: analyzedDaily,
    spikes,
    classifications,
    warnings,
    runRateWindow,
  };
}