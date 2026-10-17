import config from "./config/analysis.json";
import { median, robustStd } from "./stats";

export type DatePoint = { date: string };

export type NumericMetricKey<Point extends DatePoint> = {
  [Key in keyof Point]-?: Exclude<Point[Key], null | undefined> extends number
    ? Key
    : never;
}[keyof Point] &
  string;

export type SpikeDetectionOptions<Metric extends string> = {
  metric: Metric;
  window?: number;
  minHistory?: number;
  ratio?: number;
  zScore?: number;
  minValue?: number;
};

export type DetectedSpike<Metric extends string = string> = {
  date: string;
  index: number;
  metric: Metric;
  value: number;
  baseline: number;
  robustZScore: number | null;
  ratio: number | null;
  historyStartIndex: number;
  historyEndIndexExclusive: number;
  historySize: number;
  /** Metric-level or individual-series trigger, when known by the caller. */
  trigger?: "metric" | "series";
  seriesKey?: string;
  triggerValue?: number;
  triggerBaseline?: number;
};

/**
 * Find unusually high values in any numeric point series.
 * Results describe the observation and its baseline without changing the points.
 */
export function markSpikes<
  Point extends DatePoint,
  Metric extends NumericMetricKey<Point>,
>(
  points: readonly Point[],
  options: SpikeDetectionOptions<Metric>,
): DetectedSpike<Metric>[] {
  const {
    metric,
    window = config.detection.window,
    minHistory = config.detection.minHistory,
    ratio = config.detection.ratio,
    zScore = config.detection.zScore,
    minValue = 0,
  } = options;
  const windowSize = Math.max(1, Math.floor(window));
  const requiredHistory = Math.max(1, Math.floor(minHistory));
  const results: DetectedSpike<Metric>[] = [];

  points.forEach((point, index) => {
    const historyStartIndex = Math.max(0, index - windowSize);
    const historyEndIndexExclusive = index;
    const history: number[] = [];
    for (
      let historyIndex = historyStartIndex;
      historyIndex < historyEndIndexExclusive;
      historyIndex++
    ) {
      const item = points[historyIndex];
      const value: unknown = item[metric];
      if (typeof value === "number" && Number.isFinite(value)) {
        history.push(value);
      }
    }

    if (history.length < requiredHistory) return;

    const currentValue: unknown = point[metric];
    if (typeof currentValue !== "number" || !Number.isFinite(currentValue))
      return;

    const baseline = median(history);
    const robustScale = robustStd(history, baseline);
    const value = currentValue;
    const robustZScore =
      robustScale === 0 ? null : (value - baseline) / robustScale;
    const isSpike =
      value >= minValue &&
      value > baseline * ratio &&
      (robustScale === 0
        ? value > baseline
        : (robustZScore ?? 0) > zScore);

    if (!isSpike) return;

    results.push({
      date: point.date,
      index,
      metric,
      value,
      baseline,
      robustZScore,
      ratio: baseline === 0 ? null : value / baseline,
      historyStartIndex,
      historyEndIndexExclusive,
      historySize: history.length,
      trigger: "metric",
      triggerValue: value,
      triggerBaseline: baseline,
    });
  });

  return results;
}
