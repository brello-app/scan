// Shared types for the advice engine.
import type thresholds from "../config/thresholds.json";
import type { Provider as NormalizedProvider } from "../../data-normalizer";

/** Provider values shared with the normalized upload data contract. */
export type Provider = NormalizedProvider;
export type Confidence = "high" | "medium" | "low";
export type Stage = "model" | "cache" | "mode";
export type Section = "save" | "check"; // "Ways to save" | "Worth checking"
export type Thresholds = typeof thresholds;

// Token totals for one profile over the analysis window.
export type Tokens = {
  input: number; // uncached input
  read: number; // cache read
  w5: number; // cache write, 5 min TTL (Anthropic)
  w1h: number; // cache write, 1 hour TTL (Anthropic)
  output: number;
};

// Everything we know about one provider × model × batch combination.
export type Profile = {
  id: string; // "anthropic|claude-sonnet-5-5|std"
  provider: Provider;
  model: string; // price-table key (modelBase)
  batch: boolean;
  tokens: Tokens;
  requests: number | null; // null when the file doesn't report request counts
  fixedCostUsd: number; // spend we can't reprice (web search, unknown line items)
  source: "usage" | "cost"; // usage export (real token counts) or cost export (tokens derived from $)
  days: number; // days of data behind this profile (window minus excluded spike days)
  has: {
    requests: boolean;
    realTokens: boolean; // false when tokens were derived from cost lines
    cacheWrites: boolean;
  };
};

// The part of a profile a rule is allowed to change.
// Token totals never change; only how they're priced.
export type State = {
  model: string;
  batch: boolean;
  share: { read: number; w5: number; w1h: number }; // fractions of total input; the rest is uncached
};

export type CalcStep = { label: string; value: string };

export type Finding = {
  evidence: CalcStep[]; // facts from the data, shown above the before/after lines
};

export type RuleContext = {
  profile: Profile;
  state: State;
  applied: ReadonlySet<string>; // rule ids already applied to this profile
  toMonthly: number; // multiply window amounts by this to get 30-day amounts
  cfg: Thresholds;
};

export type Copy = {
  title: string;
  why: string;
  howTo: string;
  caveat?: string;
  docsUrl?: string;
};

export interface Rule {
  id: string;
  stage: Stage;
  appliesTo(p: Profile): boolean; // is this rule relevant to this model at all?
  requires(p: Profile): string | null; // null = we have the data; otherwise why we can't check
  confidence(p: Profile): Confidence;
  detect(ctx: RuleContext): Finding | null;
  transform(state: State, ctx: RuleContext): State;
  describe(before: State, after: State): string; // one line for the "what changes" step
  copy(ctx: RuleContext, finding: Finding): Copy;
  assumptions(ctx: RuleContext): string[];
}

export type Advice = Copy & {
  id: string; // `${ruleId}:${profileId}`
  ruleId: string;
  section: Section;
  confidence: Confidence;
  provider: Provider;
  model: string;
  monthlySavingsUsd: number;
  steps: CalcStep[];
  assumptions: string[];
};

export type CouldntCheck = {
  ruleId: string;
  provider: Provider;
  models: string[];
  reason: string;
};

export type AdviceResult = {
  waysToSave: Advice[];
  worthChecking: Advice[];
  couldntCheck: CouldntCheck[];
  hidden: Advice[]; // below the noise threshold; show collapsed as "N more small items"
  totalMonthlySavingsUsd: number; // every "save" item, including hidden ones
  runRateMonthlyUsd: number;
  windowDays: number;
  // For tests: monthly cost now vs. after every "save" item is applied.
  verification: { currentMonthlyUsd: number; afterMonthlyUsd: number; savedMonthlyUsd: number };
};
