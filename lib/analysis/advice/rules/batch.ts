// Many requests with tiny outputs look like labeling/classification jobs that can wait.
import { tok } from "../format";
import { missingRequestCountReason } from "../reasons";
import type { Rule } from "../types";

const DOCS: Record<string, string> = {
  openai: "https://platform.openai.com/docs/guides/batch",
  anthropic: "https://docs.claude.com/en/docs/build-with-claude/batch-processing",
};

export const batch: Rule = {
  id: "batch",
  stage: "mode",
  appliesTo: (p) => !p.batch,
  requires: (p) => (p.has.requests ? null : missingRequestCountReason(p)),
  confidence: () => "medium",

  detect({ profile, state, cfg }) {
    if (state.batch || !profile.requests) return null;
    const avgOut = profile.tokens.output / profile.requests;
    if (avgOut > cfg.batchableOutput) return null;
    return {
      evidence: [
        { label: "Requests", value: profile.requests.toLocaleString("en-US") },
        { label: "Avg output per request", value: `${tok(avgOut)} tokens` },
        { label: "Batch discount", value: "50%" },
      ],
    };
  },

  transform: (state) => ({ ...state, batch: true }),
  describe: () => "Run through the Batch API",

  copy: ({ profile, state }) => ({
    title: `Run ${state.model} jobs on the Batch API`,
    why: "These requests return only a few tokens each, which looks like labeling or classification.",
    howTo: "If results can wait up to 24 hours, send these requests through the Batch API.",
    caveat: "Only for jobs that don't need an instant answer.",
    docsUrl: DOCS[profile.provider],
  }),

  assumptions: () => ["These requests can tolerate a delayed response."],
};
