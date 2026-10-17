# Analysis API

This folder turns normalized `UsageRow` records into daily totals, spike
detections, reusable classifications, warnings, and a shared monthly run-rate
window. Import `analyze` from `lib/analysis`; it is the application entry point.

## Main entry point

```ts
analyze(rows: readonly UsageRow[], options?: AnalysisOptions): Analysis
```

`AnalysisOptions` can select `metric: "cost" | "tokens"` and override the
detector, classifier, and run-rate options. Defaults live in
`config/analysis.json`:

```ts
type AnalysisOptions = {
  metric?: "cost" | "tokens";
  spikes?: {
    window?: number;
    minHistory?: number;
    ratio?: number;
    zScore?: number;
    minValue?: number;
    seriesRatio?: number;
    seriesMinShareOfDay?: number;
  };
  classification?: {
    minContributionShare?: number;
    sizeJumpRatio?: number;
    compositionShiftThreshold?: number;
    singleSeriesShare?: number;
    othersMaxGrowth?: number;
    extremeMultiple?: number;
  };
  runRate?: {
    recentDays?: number;
    levelShiftMinDays?: number;
    levelShiftRatio?: number;
  };
};
```

Current defaults use a 14-day history, at least 5 observations, a 3x daily
ratio, and 3.5 robust z-score; the cost floor is $1. An individual series can
also trigger detection at 2.5x its baseline when its increase is at least 25%
of a normal day. Classification compares causes against total positive series
growth, flags a single series responsible for at least 70% when the others stay
within 1.5x their baseline, and treats an 8x total jump as suspicious. The mix
shift threshold is 0.15 total variation distance (equivalent to 0.3 summed
absolute share change). Run rate uses 14 recent days, with a level shift after
7+ days above 1.3x the prior average.

`Analysis` contains:

- `daily: AnalysisDailyPoint[]` — each `DailyPoint` (`date`, `cost`,
  `tokens: number | null`) plus `spike: "good" | "bad" | null`,
  `spikeRatio: number | null`, and `classification` for that day.
- `spikes: DetectedSpike[]` — metric, value, baseline, ratio and robust z-score,
  plus the half-open index range of the history used by the detector. Series-
  triggered events also identify the series and its value/baseline.
- `classifications: SpikeClassification[]` — metric increase, `good`/`bad`
  assessment, short English description, and the drivers behind the decision.
- `warnings: AnalysisWarning[]` — report-ready `unfamiliar-api-key` or
  `unusual-spend` warnings, including dates, models, amount and share of bill.
- `runRateWindow: RunRateWindow | null` — dates, day count, selected basis,
  total spend, suspicious spend removed, adjusted spend, daily average, and the
  30-day projection.

## Functions and data shapes

| Function | Input | Output | Purpose |
| --- | --- | --- | --- |
| `toDaily` (`daily.ts`) | `readonly UsageRow[]` | `DailyPoint[]` | Aggregate cost and available tokens by UTC date; fill missing dates with zero cost and zero or unknown tokens. |
| `markSpikes` (`spikes.ts`) | `readonly Point[]` where each point has `date` and a numeric selected metric; detector options | `DetectedSpike<Metric>[]` | Detect high values using a rolling median, robust deviation, ratio and minimum-value floor. `analyze` also applies this detector to per-series metric histories. |
| `classifySpikes` (`classify.ts`) | rows, daily points, detected spikes, optional thresholds | `SpikeClassification[]` | Identify new series, request-size jumps, dominant-series growth, composition changes, and extreme jumps; assign an assessment, suspicious spend, and reusable description. |
| `classifyWarnings` (`classify.ts`) | rows and classifications | `AnalysisWarning[]` | Convert bad cost classifications into key-level or cost-export warnings. |
| `calculateRunRateWindow` (`run-rate.ts`) | rows, daily points, classifications, warnings, optional window thresholds | `RunRateWindow \| null` | Choose one period for the monthly projection and subtract suspicious spend in that period. |
| `sum`, `mean`, `median`, `robustStd`, `addDays`, `daysBetween` (`stats.ts`) | numeric arrays or ISO dates | number or ISO date | Shared math and UTC date helpers used throughout analysis. |

### `DetectedSpike<Metric>`

Each result has `date`, `index`, `metric`, `value`, `baseline`, nullable
`robustZScore` and `ratio`, `historyStartIndex`,
`historyEndIndexExclusive`, and `historySize`. The history end index is
exclusive, matching JavaScript slice conventions. `trigger` marks aggregate or
series scope; series-triggered events include `seriesKey`, `triggerValue`, and
`triggerBaseline` while keeping `value` and `baseline` at the daily metric level.

### `SpikeClassification`

Each result has `date`, `metric`, `increase`, `suspiciousSpendUsd`, `status`
(`classified` or `unexplained`), `assessment` (`good` or `bad`), `description`,
and `drivers`.
Drivers are discriminated by `type`: `new-series`, `size-jump`, `single-series`,
`extreme-jump`, or `composition-change`. Series drivers carry a `SeriesIdentity` (provider, model,
owner type and owner ID) and contribution values. Composition drivers carry
total variation distance and the largest share changes.

### `AnalysisWarning`

Both variants share `id`, `amountUsd`, `startDate`, `endDate`, `dates`,
`activeDays`, `models`, and `shareOfBill`.

- `unfamiliar-api-key` additionally has `provider` and `apiKeyId`.
- `unusual-spend` additionally has `provider`, a human-readable `description`,
  and `spendByDate`; it is used when a cost export has no key-level data.

## Optional advice engine

The advice modules are separate from `analyze` and are not included in its
chart-facing result. The Brello Advice UI calls `buildAdvice` with rows filtered
to `runRateWindow`, passes that same monthly run rate, and excludes the warning
keys or dates from the analysis. They consume the same normalized row type:

```ts
buildProfiles(rows: readonly UsageRow[], options: ProfileOptions): BuildResult
buildAdvice(rows: readonly UsageRow[], options?: AdviceOptions): AdviceResult
```

`buildProfiles` returns `profiles` (one per provider/model/batch combination)
and `unpricedModels`. A `Profile` holds input, cache-read, cache-write and
output token totals, request availability, fixed spend, source, covered days,
and capability flags.

`buildAdvice` returns `waysToSave`, `worthChecking`, `couldntCheck`, and hidden
small recommendations, plus total monthly savings, the run-rate basis passed
in (or calculated from profiles), the window length, and a verification object
with current, after-change and saved monthly amounts. Pricing helpers in
`advice/pricer.ts` use `UnitPrices` (per-million prices) and return dollar
amounts for a profile/state pair.

## Consolidation notes

`daily.ts`, `spikes.ts`, `classify.ts`, and `run-rate.ts` are the single active
analysis pipeline. The previous parallel `series.ts`, `incidents.ts`,
`runRate.ts`, and `types.ts` pipeline had no callers and duplicated these
contracts, so it was removed. Shared aggregations and math now use the current
`UsageRow` shape from `lib/data-normalizer.ts` and helpers in `stats.ts`.
