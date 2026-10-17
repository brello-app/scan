// Groups normalized rows into one profile per provider × model × batch.
import type { UsageRow } from "../../data-normalizer";
import { TOKENS_PER_MILLION, batchFactor, unitPrices } from "./pricer";
import type { Profile, Provider } from "./types";

export type ProfileOptions = {
  excludeKeyIds?: Iterable<string>; // e.g. leaked keys: attacker traffic isn't "your usage"
  // Suspicious spike days. Only used for rows without an API key (cost exports),
  // where we can't separate the attacker's spend from yours any other way.
  excludeDates?: Iterable<string>;
  windowDays: number;
};

export type BuildResult = {
  profiles: Profile[];
  unpricedModels: string[]; // rows we couldn't use because the model isn't in prices.json
};

/** Build model profiles from normalized usage or cost rows. */
export function buildProfiles(
  rows: readonly UsageRow[],
  opts: ProfileOptions,
): BuildResult {
  const exclude = new Set(opts.excludeKeyIds ?? []);
  const badDates = new Set(opts.excludeDates ?? []);
  const datesInData = new Set<string>();

  // If a provider has a usage export, ignore its cost export: usage has real token
  // counts and API keys, and using both would count the same spend twice.
  const hasUsage = new Set<Provider>();
  for (const r of rows) {
    datesInData.add(r.date);
    if (r.costSource === "computed") hasUsage.add(r.provider);
  }
  const droppedDays = [...badDates].filter((d) => datesInData.has(d)).length;

  const map = new Map<string, Profile>();
  const unpriced = new Set<string>();

  for (const r of rows) {
    if (r.costSource === "reported" && hasUsage.has(r.provider)) continue;
    if (r.apiKeyId && exclude.has(r.apiKeyId)) continue;
    if (!r.apiKeyId && badDates.has(r.date)) continue;
    if (!r.modelBase || !unitPrices(r.provider, r.modelBase)) {
      unpriced.add(r.model);
      continue;
    }

    const source = r.costSource === "computed" ? "usage" : "cost";
    const id = `${r.provider}|${r.modelBase}|${r.batch ? "batch" : "std"}`;
    let p = map.get(id);
    if (!p) {
      p = {
        id,
        provider: r.provider,
        model: r.modelBase,
        batch: r.batch,
        tokens: { input: 0, read: 0, w5: 0, w1h: 0, output: 0 },
        requests: source === "usage" && r.requests !== null ? 0 : null,
        fixedCostUsd: 0,
        source,
        // Keyless rows lose whole spike days, so they cover fewer days.
        days: r.apiKeyId
          ? opts.windowDays
          : Math.max(1, opts.windowDays - droppedDays),
        has: {
          requests: false,
          realTokens: source === "usage",
          cacheWrites: false,
        },
      };
      map.set(id, p);
    }

    if (source === "usage") {
      p.tokens.input += r.inputTokens;
      p.tokens.read += r.cacheReadTokens;
      p.tokens.w5 += r.cacheWrite5mTokens;
      p.tokens.w1h += r.cacheWrite1hTokens;
      p.tokens.output += r.outputTokens;
      if (r.requests === null) p.requests = null;
      else if (p.requests !== null) p.requests += r.requests;
    } else {
      addCostLine(p, r);
    }
  }

  for (const p of map.values()) {
    p.has.requests = p.requests !== null && p.requests > 0;
    p.has.cacheWrites = p.tokens.w5 + p.tokens.w1h > 0;
  }

  return { profiles: [...map.values()], unpricedModels: [...unpriced] };
}

// Cost exports only give $ per token type. Divide by the unit price to recover
// token counts, so cost exports can be repriced exactly like usage exports.
/** Convert a cost-only row into estimated token counts using the configured price. */
function addCostLine(p: Profile, r: UsageRow) {
  const u = unitPrices(p.provider, p.model)!;
  const usd = r.costUsd ?? 0;
  const tokensFor = (perM: number) =>
    (usd / (perM / TOKENS_PER_MILLION)) / batchFactor(p.batch);
  switch (r.tokenType) {
    case "input":
      p.tokens.input += tokensFor(u.input);
      break;
    case "cache_read":
      p.tokens.read += tokensFor(u.read);
      break;
    case "cache_write_5m":
      p.tokens.w5 += tokensFor(u.w5);
      break;
    case "cache_write_1h":
      p.tokens.w1h += tokensFor(u.w1h);
      break;
    case "output":
      p.tokens.output += tokensFor(u.output);
      break;
    default:
      p.fixedCostUsd += usd; // web search, unknown line items: kept but never repriced
  }
}
