// Short, simple requests on a top-tier model -> try a cheaper model from the same provider.
// Always "Worth checking": averages can't tell us whether the cheaper model is good enough.
import downgrades from "../../config/downgrades.json";
import { totalInput, unitPrices } from "../pricer";
import { perM, tok } from "../format";
import { missingRequestCountReason } from "../reasons";
import type { Rule } from "../types";

const DOWN = downgrades as unknown as Record<string, Record<string, string>>;
const lowerOf = (provider: string, model: string) => DOWN[provider]?.[model];

export const downgrade: Rule = {
  id: "downgrade",
  stage: "model",
  appliesTo: (p) => !!lowerOf(p.provider, p.model),
  requires: (p) => (p.has.requests ? null : missingRequestCountReason(p)),
  confidence: () => "low",

  detect({ profile, state, applied, cfg }) {
    if (applied.has("legacy-model")) return null; // one model change per profile
    const lower = lowerOf(profile.provider, state.model);
    if (!lower || !unitPrices(profile.provider, lower) || !profile.requests) return null;
    const avgIn = totalInput(profile) / profile.requests;
    const avgOut = profile.tokens.output / profile.requests;
    if (avgIn > cfg.shortInput || avgOut > cfg.shortOutput) return null;
    const a = unitPrices(profile.provider, state.model)!;
    const b = unitPrices(profile.provider, lower)!;
    return {
      evidence: [
        { label: "Requests", value: profile.requests.toLocaleString("en-US") },
        { label: "Avg tokens per request (in / out)", value: `${tok(avgIn)} / ${tok(avgOut)}` },
        { label: `${state.model} → ${lower} (in / out)`, value: `${perM(a.input)}→${perM(b.input)} / ${perM(a.output)}→${perM(b.output)}` },
      ],
    };
  },

  transform: (state, { profile }) => ({ ...state, model: lowerOf(profile.provider, state.model)! }),
  describe: (b, a) => `Switch ${b.model} → ${a.model}`,

  copy({ profile, state }) {
    const lower = lowerOf(profile.provider, state.model)!;
    return {
      title: `Try ${lower} for short requests on ${state.model}`,
      why: `Your ${state.model} requests are short on average, which often means a simpler task.`,
      howTo: `Send a sample of these requests to ${lower} and compare the answers before switching.`,
      caveat: "Quality may drop for some tasks. Test first.",
    };
  },

  assumptions: () => ["Token counts stay the same on the cheaper model.", "The cheaper model is good enough for these requests."],
};
