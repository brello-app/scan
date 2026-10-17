// Long prompts sent again and again with almost nothing served from cache.
import { inputCost, totalInput, unitPrices } from "../pricer";
import { pct, perM, tok } from "../format";
import type { Profile, Rule } from "../types";

// Without request counts we can't confirm prompts are long enough to be cached.
const canCheckLength = (p: Profile) => p.provider === "openai" && p.has.requests;

export const promptCaching: Rule = {
  id: "prompt-caching",
  stage: "cache",
  appliesTo: (p) => totalInput(p) > 0,
  requires: () => null,
  confidence: (p) => (canCheckLength(p) ? "medium" : "low"),

  detect({ profile, state, applied, toMonthly, cfg }) {
    if (applied.has("cache-write-waste")) return null; // we just told them caching was a loss here
    if (state.share.read >= cfg.lowCacheHit) return null;
    const monthlyInput = (inputCost(profile, state) ?? 0) * toMonthly;
    if (monthlyInput < cfg.minCacheInputCostMonthly) return null;

    const evidence = [
      { label: "Input tokens", value: tok(totalInput(profile)) },
      { label: "Served from cache now", value: pct(state.share.read) },
    ];
    if (canCheckLength(profile)) {
      const avg = totalInput(profile) / profile.requests!;
      if (avg < cfg.minCacheablePrompt) return null; // prompts too short to be cached
      evidence.push({ label: "Avg prompt length", value: `${tok(avg)} tokens` });
    }
    const u = unitPrices(profile.provider, state.model)!;
    evidence.push({ label: "Input / cache read price", value: `${perM(u.input)} / ${perM(u.read)}` });
    return { evidence };
  },

  transform: (state, { profile, cfg }) => ({
    ...state,
    share: {
      read: cfg.targetCacheRead,
      w5: profile.provider === "anthropic" ? cfg.targetCacheWrite5m : 0,
      w1h: 0,
    },
  }),
  describe: (_b, a) => `Serve ${pct(a.share.read)} of input from cache`,

  copy: ({ profile, state }) =>
    profile.provider === "anthropic"
      ? {
          title: `Turn on prompt caching for ${state.model}`,
          why: "Almost none of your input is served from cache.",
          howTo: "Put the stable part of your prompt (system prompt, tools, long context) first and mark it with cache_control.",
          caveat: "Savings depend on how much of each prompt repeats. We can't see prompt lengths in this export.",
          docsUrl: "https://docs.claude.com/en/docs/build-with-claude/prompt-caching",
        }
      : {
          title: `Get more cache hits on ${state.model}`,
          why: "OpenAI caches long prompts automatically, but almost none of yours are hitting the cache.",
          howTo: "Move the parts that never change (instructions, examples, tool definitions) to the start of the prompt and keep them byte-for-byte identical.",
          caveat: "Savings depend on how much of each prompt repeats.",
          docsUrl: "https://platform.openai.com/docs/guides/prompt-caching",
        },

  assumptions: ({ profile, cfg }) => [
    `${pct(cfg.targetCacheRead)} of input can be served from cache` +
      (profile.provider === "anthropic" ? `, with ${pct(cfg.targetCacheWrite5m)} written to the 5-minute cache.` : "."),
  ],
};
