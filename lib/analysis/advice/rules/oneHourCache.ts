// 1-hour cache writes cost more than 5-minute ones. If requests come in often,
// the 5-minute cache gets refreshed anyway.
import { unitPrices } from "../pricer";
import { pct, perM } from "../format";
import type { Rule } from "../types";

export const oneHourCache: Rule = {
  id: "one-hour-cache",
  stage: "cache",
  appliesTo: (p) => p.provider === "anthropic" && p.tokens.w1h > 0,
  requires: () => null,
  confidence: () => "medium",

  detect({ profile, state }) {
    if (state.share.w1h <= 0) return null; // already removed by an earlier rule
    const u = unitPrices(profile.provider, state.model);
    if (!u || u.w1h <= u.w5) return null;
    return {
      evidence: [
        { label: "Input written to 1h cache", value: pct(state.share.w1h) },
        { label: "1h vs 5m write price", value: `${perM(u.w1h)} vs ${perM(u.w5)}` },
      ],
    };
  },

  transform: (state) => ({ ...state, share: { ...state.share, w5: state.share.w5 + state.share.w1h, w1h: 0 } }),
  describe: () => "Use the 5-minute cache instead of 1-hour",

  copy: ({ state }) => ({
    title: `Use the 5-minute cache on ${state.model}`,
    why: "You're writing to the 1-hour cache, which costs more per token than the 5-minute cache.",
    howTo: 'Drop "ttl": "1h" from cache_control. Every cache hit refreshes the 5-minute timer, so steady traffic keeps it warm.',
    caveat: "Keep the 1-hour cache if requests are more than 5 minutes apart.",
    docsUrl: "https://docs.claude.com/en/docs/build-with-claude/prompt-caching",
  }),

  assumptions: () => ["Requests reuse the cache within 5 minutes."],
};
