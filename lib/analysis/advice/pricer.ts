// Prices a profile under a given state. Every savings number comes from here:
// savings = price(before) - price(after). Never compute savings anywhere else.
import prices from "../config/prices.json";
import type { Profile, Provider, State } from "./types";

/** Token scale used by all per-million model prices. */
export const TOKENS_PER_MILLION = 1_000_000;

type OAPrice = { input: number; cached_input: number; output: number };
type ANPrice = {
  input: number;
  cache_write_5m: number;
  cache_write_1h: number;
  cache_read: number;
  output: number;
};
const OA = prices.openai as Record<string, OAPrice>;
const AN = prices.anthropic as Record<string, ANPrice>;

// Per-million unit prices in one shape for both providers.
export type UnitPrices = {
  input: number;
  read: number;
  w5: number;
  w1h: number;
  output: number;
};

/** Resolve the per-million unit prices for a supported provider and model. */
export function unitPrices(
  provider: Provider,
  model: string,
): UnitPrices | null {
  if (provider === "openai") {
    const p = OA[model];
    // OpenAI has no cache write fee; writes would be billed as normal input.
    return p
      ? {
          input: p.input,
          read: p.cached_input,
          w5: p.input,
          w1h: p.input,
          output: p.output,
        }
      : null;
  }
  const p = AN[model];
  return p
    ? {
        input: p.input,
        read: p.cache_read,
        w5: p.cache_write_5m,
        w1h: p.cache_write_1h,
        output: p.output,
      }
    : null;
}

/** Return the price multiplier applied to batch requests. */
export const batchFactor = (batch: boolean) => (batch ? 0.5 : 1);

/** Sum every input token category represented in a profile. */
export function totalInput(p: Profile) {
  const t = p.tokens;
  return t.input + t.read + t.w5 + t.w1h;
}

// The state that reproduces what the user is doing today.
export function currentState(p: Profile): State {
  const total = totalInput(p);
  const s = (n: number) => (total > 0 ? n / total : 0);
  return {
    model: p.model,
    batch: p.batch,
    share: {
      read: s(p.tokens.read),
      w5: s(p.tokens.w5),
      w1h: s(p.tokens.w1h),
    },
  };
}

// Input-side cost only (used by rules that reason about input spend).
export function inputCost(p: Profile, st: State): number | null {
  const u = unitPrices(p.provider, st.model);
  if (!u) return null;
  const total = totalInput(p);
  const uncached = 1 - st.share.read - st.share.w5 - st.share.w1h;
  const perToken =
    uncached * u.input +
    st.share.read * u.read +
    st.share.w5 * u.w5 +
    st.share.w1h * u.w1h;
  return ((total * perToken) / TOKENS_PER_MILLION) * batchFactor(st.batch);
}

// Full cost of the profile under a state, in USD over the analysis window.
/** Price all profile tokens and fixed line items under a proposed state. */
export function price(p: Profile, st: State): number | null {
  const u = unitPrices(p.provider, st.model);
  const inp = inputCost(p, st);
  if (!u || inp === null) return null;
  const out =
    ((p.tokens.output * u.output) / TOKENS_PER_MILLION) *
    batchFactor(st.batch);
  return inp + out + p.fixedCostUsd;
}
