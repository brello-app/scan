import type { UsageRow } from "../data-normalizer";
import config from "./config/analysis.json";
import {
  isUsageExport,
  rowTokenCount,
  type DailyMetric,
  type DailyPoint,
} from "./daily";
import type { DetectedSpike } from "./spikes";
import { median } from "./stats";

type SeriesUsage = {
  cost: number;
  tokens: number;
  requests: number;
  hasRequestData: boolean;
};

export type SeriesIdentity = {
  provider: UsageRow["provider"];
  model: string;
  ownerType: "api-key" | "service-account" | "project" | "workspace" | "account";
  ownerId: string | null;
};

export type ClassificationDriver =
  | {
      type: "new-series";
      seriesKey: string;
      series: SeriesIdentity;
      contribution: number;
      contributionShare: number;
    }
  | {
      type: "size-jump";
      seriesKey: string;
      series: SeriesIdentity;
      contribution: number;
      contributionShare: number;
      baselineTokensPerRequest: number;
      observedTokensPerRequest: number;
      ratio: number;
    }
  | {
      type: "composition-change";
      totalVariationDistance: number;
      largestShareChanges: Array<{
        seriesKey: string;
        baselineShare: number;
        observedShare: number;
        change: number;
      }>;
    }
  | {
      type: "single-series";
      seriesKey: string;
      series: SeriesIdentity;
      contribution: number;
      contributionShare: number;
      ratio: number;
    }
  | {
      type: "extreme-jump";
      ratio: number;
    };

export type SpikeClassification = {
  date: string;
  metric: DailyMetric;
  increase: number;
  suspiciousSpendUsd: number;
  status: "classified" | "unexplained";
  assessment: "good" | "bad";
  description: string;
  drivers: ClassificationDriver[];
};

type AnalysisWarningBase = {
  id: string;
  amountUsd: number;
  startDate: string;
  endDate: string;
  dates: string[];
  activeDays: number;
  models: string[];
  shareOfBill: number;
};

export type AnalysisWarning =
  | (AnalysisWarningBase & {
      type: "unfamiliar-api-key";
      provider: UsageRow["provider"];
      apiKeyId: string;
    })
  | (AnalysisWarningBase & {
      type: "unusual-spend";
      provider: UsageRow["provider"];
      description: string;
      spendByDate: Record<string, number>;
    });

export type ClassificationOptions = {
  minContributionShare?: number;
  sizeJumpRatio?: number;
  compositionShiftThreshold?: number;
  singleSeriesShare?: number;
  othersMaxGrowth?: number;
  extremeMultiple?: number;
};

function seriesIdentity(row: UsageRow): SeriesIdentity {
  if (row.apiKeyId) {
    return {
      provider: row.provider,
      model: row.model,
      ownerType: "api-key",
      ownerId: row.apiKeyId,
    };
  }
  if (row.serviceAccountId) {
    return {
      provider: row.provider,
      model: row.model,
      ownerType: "service-account",
      ownerId: row.serviceAccountId,
    };
  }
  if (row.projectId) {
    return {
      provider: row.provider,
      model: row.model,
      ownerType: "project",
      ownerId: row.projectId,
    };
  }
  if (row.workspaceId) {
    return {
      provider: row.provider,
      model: row.model,
      ownerType: "workspace",
      ownerId: row.workspaceId,
    };
  }
  return {
    provider: row.provider,
    model: row.model,
    ownerType: "account",
    ownerId: row.accountId,
  };
}

function seriesKey(identity: SeriesIdentity): string {
  return JSON.stringify([
    identity.provider,
    identity.ownerType,
    identity.ownerId,
    identity.model,
  ]);
}

/** Share the same provider, owner, and model identity between classification and detection. */
export function analysisSeriesKey(row: UsageRow): string {
  return seriesKey(seriesIdentity(row));
}

type AggregatedSeries = {
  byDate: Map<string, Map<string, SeriesUsage>>;
  identities: Map<string, SeriesIdentity>;
};

function aggregateSeries(rows: readonly UsageRow[]): AggregatedSeries {
  const byDate = new Map<string, Map<string, SeriesUsage>>();
  const identities = new Map<string, SeriesIdentity>();

  for (const row of rows) {
    const day = byDate.get(row.date) ?? new Map<string, SeriesUsage>();
    const identity = seriesIdentity(row);
    const key = analysisSeriesKey(row);
    const current = day.get(key) ?? {
      cost: 0,
      tokens: 0,
      requests: 0,
      hasRequestData: false,
    };

    current.cost += row.costUsd ?? 0;
    current.tokens += rowTokenCount(row);
    if (row.requests !== null) {
      current.requests += row.requests;
      current.hasRequestData = true;
    }
    day.set(key, current);
    byDate.set(row.date, day);
    if (!identities.has(key)) identities.set(key, identity);
  }

  return { byDate, identities };
}

function metricValue(value: SeriesUsage | undefined, metric: DailyMetric) {
  return value?.[metric] ?? 0;
}

function describeSpike(
  spike: DetectedSpike<DailyMetric>,
  assessment: SpikeClassification["assessment"],
  drivers: readonly ClassificationDriver[],
): string {
  if (assessment === "good") {
    if (spike.trigger === "series") {
      return "One series grew sharply, but no suspicious pattern was detected.";
    }
    return spike.ratio === null
      ? "All usage rose together. Looks like a launch."
      : "All usage up ~" + Math.round(spike.ratio) + "x. Looks like a launch.";
  }

  const newSeries = drivers.find(
    (driver): driver is Extract<ClassificationDriver, { type: "new-series" }> =>
      driver.type === "new-series",
  );
  if (newSeries) {
    const model = newSeries.series.model || "unknown model";
    return newSeries.series.ownerType === "api-key"
      ? "Unknown key · " + model
      : "New series · " + model;
  }

  const sizeJump = drivers.find(
    (driver): driver is Extract<ClassificationDriver, { type: "size-jump" }> =>
      driver.type === "size-jump",
  );
  if (sizeJump) return "Request size jump · " + sizeJump.series.model;

  const singleSeries = drivers.find(
    (driver): driver is Extract<ClassificationDriver, { type: "single-series" }> =>
      driver.type === "single-series",
  );
  if (singleSeries) {
    return (
      "One series jumped ~" +
      Math.round(singleSeries.ratio) +
      "x while the rest stayed flat · " +
      singleSeries.series.model
    );
  }

  if (drivers.some((driver) => driver.type === "composition-change")) {
    return "Usage mix changed sharply";
  }

  const extremeJump = drivers.find(
    (driver): driver is Extract<ClassificationDriver, { type: "extreme-jump" }> =>
      driver.type === "extreme-jump",
  );
  if (extremeJump) {
    const subject = spike.metric === "cost" ? "Spend" : "Usage";
    return subject + " jumped ~" + Math.round(extremeJump.ratio) + "x in a day. Was this expected?";
  }

  return "No clear cause identified";
}

/** Describe likely drivers and apply the configured good/bad assessment heuristic. */
export function classifySpikes(
  rows: readonly UsageRow[],
  daily: readonly DailyPoint[],
  spikes: readonly DetectedSpike<DailyMetric>[],
  options: ClassificationOptions = {},
): SpikeClassification[] {
  const {
    minContributionShare = config.classification.newShare,
    sizeJumpRatio = config.classification.sizeJump,
    compositionShiftThreshold = config.classification.maxMixShift,
    singleSeriesShare = config.classification.singleSeriesShare,
    othersMaxGrowth = config.classification.othersMaxGrowth,
    extremeMultiple = config.classification.extremeMultiple,
  } = options;
  const { byDate, identities } = aggregateSeries(rows);

  return spikes.map((spike): SpikeClassification => {
    const point = daily[spike.index];
    const increase = spike.value - spike.baseline;

    if (!point) {
      return {
        date: spike.date,
        metric: spike.metric,
        increase,
        suspiciousSpendUsd: 0,
        status: "unexplained",
        assessment: "bad",
        description: "Spike could not be explained.",
        drivers: [],
      };
    }

    const historyDates = daily
      .slice(spike.historyStartIndex, spike.historyEndIndexExclusive)
      .map(({ date }) => date);
    const today = byDate.get(spike.date);
    const keys = new Set<string>(today?.keys() ?? []);

    for (const date of historyDates) {
      for (const key of byDate.get(date)?.keys() ?? []) keys.add(key);
    }

    const historyTotals = new Map<string, number>();
    for (const date of historyDates) {
      let total = 0;
      for (const value of byDate.get(date)?.values() ?? []) {
        total += value[spike.metric];
      }
      historyTotals.set(date, total);
    }

    type SeriesChange = {
      key: string;
      series: SeriesIdentity;
      baseline: number;
      current: number;
      contribution: number;
      isNew: boolean;
      isSizeJump: boolean;
      baselineTokensPerRequest: number;
      observedTokensPerRequest: number;
      sizeJumpRatio: number;
    };

    const changes: SeriesChange[] = [];
    const baseShares = new Map<string, number>();

    for (const key of keys) {
      const historyValues = historyDates.map((date) =>
        byDate.get(date)?.get(key),
      );
      const baseline = median(
        historyValues.map((value) => metricValue(value, spike.metric)),
      );
      const currentEntry = today?.get(key);
      const current = metricValue(currentEntry, spike.metric);
      const contribution = current - baseline;
      const historicalSizes = historyValues
        .filter(
          (value): value is SeriesUsage =>
            !!value && value.hasRequestData && value.requests > 0,
        )
        .map((value) => value.tokens / value.requests);
      const baselineTokensPerRequest = median(historicalSizes);
      const observedTokensPerRequest =
        currentEntry?.hasRequestData && currentEntry.requests > 0
          ? currentEntry.tokens / currentEntry.requests
          : 0;
      const observedSizeRatio =
        baselineTokensPerRequest > 0
          ? observedTokensPerRequest / baselineTokensPerRequest
          : 0;
      const isSizeJump =
        baseline > 0 &&
        contribution > 0 &&
        observedTokensPerRequest > 0 &&
        historicalSizes.length > 0 &&
        observedSizeRatio >= sizeJumpRatio;

      changes.push({
        key,
        series: identities.get(key)!,
        baseline,
        current,
        contribution,
        isNew: baseline === 0 && current > 0,
        isSizeJump,
        baselineTokensPerRequest,
        observedTokensPerRequest,
        sizeJumpRatio: observedSizeRatio,
      });

      const dailyShares = historyDates.map((date) => {
        const total = historyTotals.get(date) ?? 0;
        return total > 0
          ? metricValue(byDate.get(date)?.get(key), spike.metric) / total
          : 0;
      });
      baseShares.set(key, median(dailyShares));
    }

    // Compare drivers with total positive growth so unrelated declines don't
    // inflate a cause's share of the day's change.
    const growth = changes.reduce(
      (total, change) => total + Math.max(0, change.contribution),
      0,
    );
    const newSeriesContribution = changes
      .filter((change) => change.isNew)
      .reduce((total, change) => total + Math.max(0, change.contribution), 0);
    const sizeJumpContribution = changes
      .filter((change) => change.isSizeJump)
      .reduce((total, change) => total + Math.max(0, change.contribution), 0);
    const newSeriesIsSuspicious =
      growth > 0 && newSeriesContribution / growth > minContributionShare;
    const sizeJumpIsSuspicious =
      growth > 0 && sizeJumpContribution / growth > minContributionShare;

    const drivers: ClassificationDriver[] = [];
    if (growth > 0) {
      for (const change of changes) {
        const contributionShare = Math.max(0, change.contribution) / growth;
        if (change.isNew && contributionShare >= minContributionShare) {
          drivers.push({
            type: "new-series",
            seriesKey: change.key,
            series: change.series,
            contribution: change.contribution,
            contributionShare,
          });
        }
        if (change.isSizeJump && contributionShare >= minContributionShare) {
          drivers.push({
            type: "size-jump",
            seriesKey: change.key,
            series: change.series,
            contribution: change.contribution,
            contributionShare,
            baselineTokensPerRequest: change.baselineTokensPerRequest,
            observedTokensPerRequest: change.observedTokensPerRequest,
            ratio: change.sizeJumpRatio,
          });
        }
      }
    }

    const currentTotal = [...(today?.values() ?? [])].reduce(
      (total, value) => total + value[spike.metric],
      0,
    );
    const baseShareTotal = [...baseShares.values()].reduce(
      (total, share) => total + share,
      0,
    );
    let compositionShift = 0;
    const shareChanges: Array<{
      seriesKey: string;
      baselineShare: number;
      observedShare: number;
      change: number;
    }> = [];

    if (baseShareTotal > 0 && currentTotal > 0) {
      let absoluteChange = 0;
      for (const key of keys) {
        const baselineShare = (baseShares.get(key) ?? 0) / baseShareTotal;
        const observedShare =
          metricValue(today?.get(key), spike.metric) / currentTotal;
        const change = observedShare - baselineShare;
        absoluteChange += Math.abs(change);
        shareChanges.push({
          seriesKey: key,
          baselineShare,
          observedShare,
          change,
        });
      }
      compositionShift = Math.min(1, absoluteChange / 2);
    }
    const compositionIsSuspicious =
      compositionShift >= compositionShiftThreshold;

    const establishedSeries = changes.filter((change) => change.baseline > 0);
    const topChange = [...changes].sort(
      (left, right) => right.contribution - left.contribution,
    )[0];
    const others = changes.filter((change) => change !== topChange);
    const othersBaseline = others.reduce(
      (total, change) => total + change.baseline,
      0,
    );
    const othersCurrent = others.reduce(
      (total, change) => total + change.current,
      0,
    );
    const singleSeriesIsSuspicious =
      !!topChange &&
      establishedSeries.length >= 2 &&
      growth > 0 &&
      Math.max(0, topChange.contribution) / growth >= singleSeriesShare &&
      othersCurrent <= Math.max(othersBaseline, 1e-9) * othersMaxGrowth;
    if (singleSeriesIsSuspicious && topChange) {
      drivers.push({
        type: "single-series",
        seriesKey: topChange.key,
        series: topChange.series,
        contribution: topChange.contribution,
        contributionShare: Math.max(0, topChange.contribution) / growth,
        ratio:
          topChange.baseline > 0
            ? topChange.current / topChange.baseline
            : 0,
      });
    }

    if (compositionIsSuspicious) {
      drivers.push({
        type: "composition-change",
        totalVariationDistance: compositionShift,
        largestShareChanges: shareChanges
          .sort((a, b) => Math.abs(b.change) - Math.abs(a.change))
          .slice(0, 5),
      });
    }

    const extremeRatio = spike.ratio ?? 0;
    const extremeJumpIsSuspicious =
      spike.baseline > 0 && extremeRatio >= extremeMultiple;
    if (extremeJumpIsSuspicious) {
      drivers.push({ type: "extreme-jump", ratio: extremeRatio });
    }

    const assessment =
      newSeriesIsSuspicious ||
      sizeJumpIsSuspicious ||
      singleSeriesIsSuspicious ||
      compositionIsSuspicious ||
      extremeJumpIsSuspicious
        ? "bad"
        : "good";
    let suspiciousSpendUsd = 0;
    if (spike.metric === "cost" && assessment === "bad") {
      if (newSeriesIsSuspicious) {
        suspiciousSpendUsd = newSeriesContribution;
      } else if (sizeJumpIsSuspicious) {
        suspiciousSpendUsd = sizeJumpContribution;
      } else if (singleSeriesIsSuspicious && topChange) {
        suspiciousSpendUsd = topChange.contribution;
      } else if (compositionIsSuspicious || extremeJumpIsSuspicious) {
        suspiciousSpendUsd = Math.max(0, increase);
      }
      suspiciousSpendUsd = Math.min(
        Math.max(0, suspiciousSpendUsd),
        point.cost,
      );
    }

    const description = describeSpike(spike, assessment, drivers);
    return {
      date: spike.date,
      metric: spike.metric,
      increase,
      suspiciousSpendUsd,
      status: drivers.length > 0 ? "classified" : "unexplained",
      assessment,
      description,
      drivers,
    };
  });
}
/** Turn suspicious classifications into reusable report warning data. */
export function classifyWarnings(
  rows: readonly UsageRow[],
  classifications: readonly SpikeClassification[],
): AnalysisWarning[] {
  const keyRef = (provider: UsageRow["provider"], apiKeyId: string) =>
    JSON.stringify([provider, apiKeyId]);
  type KeySpend = {
    provider: UsageRow["provider"];
    apiKeyId: string;
    firstSeen: string;
    amountUsd: number;
    dates: Set<string>;
    models: Set<string>;
  };

  let totalBill = 0;
  let isCostExport = false;
  const modelsByDate = new Map<string, Set<string>>();
  const spendByKey = new Map<string, KeySpend>();
  for (const row of rows) {
    if (!isUsageExport(row)) isCostExport = true;
    totalBill += row.costUsd ?? 0;
    const models = modelsByDate.get(row.date) ?? new Set<string>();
    models.add(row.model);
    modelsByDate.set(row.date, models);

    if (!row.apiKeyId) continue;

    const ref = keyRef(row.provider, row.apiKeyId);
    const spend = spendByKey.get(ref) ?? {
      provider: row.provider,
      apiKeyId: row.apiKeyId,
      firstSeen: row.date,
      amountUsd: 0,
      dates: new Set<string>(),
      models: new Set<string>(),
    };
    if (row.date < spend.firstSeen) spend.firstSeen = row.date;

    const cost = row.costUsd ?? 0;
    if (cost > 0) {
      spend.amountUsd += cost;
      spend.dates.add(row.date);
      spend.models.add(row.model);
    }
    spendByKey.set(ref, spend);
  }

  const candidates = new Map<string, KeySpend>();
  const apiKeyWarningDates = new Set<string>();

  for (const classification of classifications) {
    if (
      classification.metric !== "cost" ||
      classification.assessment !== "bad"
    ) {
      continue;
    }

    for (const driver of classification.drivers) {
      if (
        driver.type !== "new-series" ||
        driver.series.ownerType !== "api-key" ||
        !driver.series.ownerId
      ) {
        continue;
      }

      const apiKeyId = driver.series.ownerId;
      const ref = keyRef(driver.series.provider, apiKeyId);
      const spend = spendByKey.get(ref);
      if (!spend || spend.firstSeen !== classification.date) continue;

      candidates.set(ref, spend);
      apiKeyWarningDates.add(classification.date);
    }
  }

  const warnings: AnalysisWarning[] = [];

  for (const [ref, spend] of candidates) {
    const dates = [...spend.dates].sort();
    if (spend.amountUsd <= 0 || dates.length === 0) continue;

    warnings.push({
      id: ref,
      type: "unfamiliar-api-key",
      provider: spend.provider,
      apiKeyId: spend.apiKeyId,
      amountUsd: spend.amountUsd,
      startDate: dates[0],
      endDate: dates[dates.length - 1],
      dates,
      activeDays: dates.length,
      models: [...spend.models].sort(),
      shareOfBill: totalBill > 0 ? spend.amountUsd / totalBill : 0,
    });
  }

  // Cost exports have spend and model/project metadata, but no API key or
  // token counts. Preserve useful spike alerts without implying a leaked key.
  if (isCostExport) {
    const suspicious = classifications.filter(
      (classification) =>
        classification.metric === "cost" &&
        classification.assessment === "bad" &&
        !apiKeyWarningDates.has(classification.date) &&
        classification.suspiciousSpendUsd > 0,
    );
    const spendByDate = new Map<string, number>();
    const models = new Set<string>();
    for (const classification of suspicious) {
      spendByDate.set(
        classification.date,
        (spendByDate.get(classification.date) ?? 0) +
          classification.suspiciousSpendUsd,
      );
      for (const model of modelsByDate.get(classification.date) ?? []) {
        models.add(model);
      }
    }
    const suspiciousDates = [...spendByDate.keys()].sort();
    const amountUsd = [...spendByDate.values()].reduce(
      (total, amount) => total + amount,
      0,
    );

    if (amountUsd > 0 && suspiciousDates.length > 0) {
      const provider = rows[0]?.provider ?? "openai";
      const descriptions = [
        ...new Set(suspicious.map(({ description }) => description)),
      ];

      warnings.push({
        id: "unusual-spend:" + suspiciousDates.join(","),
        type: "unusual-spend",
        provider,
        amountUsd,
        startDate: suspiciousDates[0],
        endDate: suspiciousDates[suspiciousDates.length - 1],
        dates: suspiciousDates,
        activeDays: suspiciousDates.length,
        models: [...models].sort(),
        shareOfBill: totalBill > 0 ? amountUsd / totalBill : 0,
        description: descriptions.join(" · ") || "Unusual cost spike",
        spendByDate: Object.fromEntries(spendByDate),
      });
    }  }

  return warnings.sort((a, b) => b.amountUsd - a.amountUsd);
}


