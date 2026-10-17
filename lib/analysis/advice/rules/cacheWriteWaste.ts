// Anthropic charges extra to write to the cache. If those writes are rarely read back,
// caching costs more than it saves.
import { TOKENS_PER_MILLION, totalInput, unitPrices } from "../pricer";
import { pct, usd } from "../format";
import type { Rule } from "../types";

export const cacheWriteWaste: Rule = {
  id: "cache-write-waste",
  stage: "cache",
  appliesTo: (p) => p.provider === "anthropic" && p.has.cacheWrites,
  requires: () => null,
  confidence: () => "high",

  detect({ profile, state }) {
    const u = unitPrices(profile.provider, state.model);
    if (!u) return null;
    const total = totalInput(profile);
    const { read, w5, w1h } = state.share;
    // What the cache costs on top of plain input, and what it saves.
    const premium =
      (total * (w5 * (u.w5 - u.input) + w1h * (u.w1h - u.input))) /
      TOKENS_PER_MILLION;
    const benefit =
      (total * read * (u.input - u.read)) / TOKENS_PER_MILLION;
    if (premium <= benefit) return null;
    return {
      evidence: [
        { label: "Input written to cache", value: pct(w5 + w1h) },
        { label: "Input read from cache", value: pct(read) },
        { label: "Extra paid for cache writes", value: usd(premium) },
        { label: "Saved by cache reads", value: usd(benefit) },
      ],
    };
  },

  // Turning caching off: everything becomes plain input.
  transform: (state) => ({ ...state, share: { read: 0, w5: 0, w1h: 0 } }),
  describe: () => "Stop writing to the cache",

  copy: ({ state }) => ({
    title: `Prompt caching on ${state.model} costs more than it saves`,
    why: "You pay extra to write prompts to the cache, but they're rarely read back before they expire.",
    howTo:
      "Only mark content that is reused across many requests (system prompt, tool definitions, long documents) with cache_control, and keep that prefix identical. Remove cache_control from parts that change every request.",
    caveat: "If you fix the prefix instead of turning caching off, you may save even more.",
    docsUrl: "https://docs.claude.com/en/docs/build-with-claude/prompt-caching",
  }),

  assumptions: () => [],
};
