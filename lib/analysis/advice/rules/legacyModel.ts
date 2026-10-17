// Previous-generation model -> current model in the same tier, when it's cheaper
// for this user's actual mix of tokens.
import successors from "../../config/successors.json";
import { price, unitPrices } from "../pricer";
import { perM } from "../format";
import type { Rule } from "../types";

const NEXT = successors as unknown as Record<string, Record<string, string>>;
const nextOf = (provider: string, model: string) => NEXT[provider]?.[model];

const DOCS: Record<string, string> = {
  openai: "https://platform.openai.com/docs/models",
  anthropic: "https://docs.claude.com/en/docs/about-claude/models/overview",
};

export const legacyModel: Rule = {
  id: "legacy-model",
  stage: "model",
  appliesTo: (p) => !!nextOf(p.provider, p.model),
  requires: () => null, // works with usage or cost exports
  confidence: () => "high",

  detect({ profile, state }) {
    const next = nextOf(profile.provider, state.model);
    if (!next || !unitPrices(profile.provider, next)) return null;
    const now = price(profile, state);
    const after = price(profile, { ...state, model: next });
    if (now === null || after === null || after >= now) return null; // only when it's actually cheaper
    const a = unitPrices(profile.provider, state.model)!;
    const b = unitPrices(profile.provider, next)!;
    return {
      evidence: [
        { label: `${state.model} price (in / out)`, value: `${perM(a.input)} / ${perM(a.output)}` },
        { label: `${next} price (in / out)`, value: `${perM(b.input)} / ${perM(b.output)}` },
      ],
    };
  },

  transform: (state, { profile }) => ({ ...state, model: nextOf(profile.provider, state.model)! }),
  describe: (b, a) => `Switch ${b.model} → ${a.model}`,

  copy({ profile, state }) {
    const next = nextOf(profile.provider, state.model)!;
    return {
      title: `Upgrade ${state.model} to ${next}`,
      why: `${next} is the current model in the same tier and costs less for your mix of tokens.`,
      howTo: `Change the model name to ${next}. Re-run your evals first, since behavior can change between generations.`,
      caveat: "Newer models can format answers differently.",
      docsUrl: DOCS[profile.provider],
    };
  },

  assumptions: () => ["Token counts stay the same on the newer model."],
};
