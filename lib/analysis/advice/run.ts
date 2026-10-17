// Runs every rule against every profile and turns the results into advice.
//
// How double counting is avoided: each profile has a state. A "save" rule changes
// the state, and its savings are price(before) - price(after). The next rule starts
// from the changed state. "Check" rules are priced but never change the state,
// so an uncertain suggestion can't shrink a certain one.
import thresholds from "../config/thresholds.json";
import type { UsageRow } from "../../data-normalizer";
import { daysBetween, sum } from "../stats";
import { buildProfiles } from "./profile";
import { currentState, price } from "./pricer";
import { RULES } from "./rules";
import { usd } from "./format";
import type {
  Advice,
  AdviceResult,
  CouldntCheck,
  Profile,
  RuleContext,
  State,
} from "./types";

export type AdviceOptions = {
  excludeKeyIds?: Iterable<string>; // suspicious keys from spike analysis
  excludeDates?: Iterable<string>; // suspicious spike days; only applied to rows without API keys
  windowDays?: number; // days covered by `rows`; defaults to first→last date
  runRateMonthlyUsd?: number; // pass the same number the KPI card shows; computed if omitted
};

function spanDays(rows: readonly UsageRow[]): number {
  if (rows.length === 0) return 1;

  let first = rows[0].date;
  let last = rows[0].date;
  for (const row of rows) {
    if (row.date < first) first = row.date;
    if (row.date > last) last = row.date;
  }
  return daysBetween(first, last);
}

/** Run the configured savings rules and return report-ready advice. */
export function buildAdvice(
  rows: readonly UsageRow[],
  opts: AdviceOptions = {},
): AdviceResult {
  const cfg = thresholds;
  const windowDays = opts.windowDays ?? spanDays(rows);
  const { profiles } = buildProfiles(rows, {
    excludeKeyIds: opts.excludeKeyIds,
    excludeDates: opts.excludeDates,
    windowDays,
  });
  const monthlyOf = (p: Profile) => 30 / p.days;

  const currentMonthlyUsd = sum(
    profiles.map(
      (p) => (price(p, currentState(p)) ?? 0) * monthlyOf(p),
    ),
  );
  const runRateMonthlyUsd = opts.runRateMonthlyUsd ?? currentMonthlyUsd;

  const items: Advice[] = [];
  const missing = new Map<string, CouldntCheck>();
  let afterMonthlyUsd = 0;

  for (const profile of profiles) {
    const toMonthly = monthlyOf(profile);
    let state = currentState(profile);
    const applied = new Set<string>();

    for (const rule of RULES) {
      if (!rule.appliesTo(profile)) continue;

      const reason = rule.requires(profile);
      if (reason) {
        const key = `${rule.id}|${profile.provider}`;
        const entry = missing.get(key) ?? {
          ruleId: rule.id,
          provider: profile.provider,
          models: [],
          reason,
        };
        if (!entry.models.includes(profile.model)) entry.models.push(profile.model);
        missing.set(key, entry);
        continue;
      }

      const ctx: RuleContext = { profile, state, applied, toMonthly, cfg };
      const finding = rule.detect(ctx);
      if (!finding) continue;

      const next = rule.transform(state, ctx);
      const before = price(profile, state);
      const after = price(profile, next);
      if (before === null || after === null || before - after <= 0) continue;

      const confidence = rule.confidence(profile);
      const section = confidence === "low" ? "check" : "save";
      const monthly = (before - after) * toMonthly;

      items.push({
        ...rule.copy(ctx, finding),
        id: `${rule.id}:${profile.id}`,
        ruleId: rule.id,
        section,
        confidence,
        provider: profile.provider,
        model: profile.model,
        monthlySavingsUsd: monthly,
        steps: [
          ...finding.evidence,
          { label: `Cost now (${profile.days} days)`, value: usd(before) },
          { label: rule.describe(state, next), value: usd(after) },
          {
            label: `Difference × ${toMonthly.toFixed(2)} (to 30 days)`,
            value: `${usd(monthly)}/mo`,
          },
        ],
        assumptions: rule.assumptions(ctx),
      });

      if (section === "save") {
        state = next;
        applied.add(rule.id);
      }
    }
    afterMonthlyUsd += (price(profile, state) ?? 0) * toMonthly;
  }

  // Hide noise: tiny in dollars, or tiny relative to what they normally spend.
  const minUsd = Math.max(
    cfg.minMonthlySavings,
    runRateMonthlyUsd * cfg.minShareOfRunRate,
  );
  const visible = items.filter((a) => a.monthlySavingsUsd >= minUsd);
  const hidden = items.filter((a) => a.monthlySavingsUsd < minUsd);
  const bySavings = (a: Advice, b: Advice) =>
    b.monthlySavingsUsd - a.monthlySavingsUsd;

  const waysToSave = visible.filter((a) => a.section === "save").sort(bySavings);
  const worthChecking = visible.filter((a) => a.section === "check").sort(bySavings);

  return {
    waysToSave,
    worthChecking,
    couldntCheck: [...missing.values()],
    hidden: hidden.sort(bySavings),
    // Hidden "save" items were still applied to the state, so the honest total includes them.
    totalMonthlySavingsUsd: sum(
      items
        .filter((a) => a.section === "save")
        .map((a) => a.monthlySavingsUsd),
    ),
    runRateMonthlyUsd,
    windowDays,
    verification: {
      currentMonthlyUsd,
      afterMonthlyUsd,
      savedMonthlyUsd: currentMonthlyUsd - afterMonthlyUsd,
    },
  };
}

export type { Advice, AdviceResult, Profile, State };
