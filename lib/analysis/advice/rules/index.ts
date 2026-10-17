// Rules run in this exact order. Each one sees the state left by the ones before it,
// which is what keeps savings from being counted twice.
import type { Rule } from "../types";
import { legacyModel } from "./legacyModel";
import { downgrade } from "./downgrade";
import { cacheWriteWaste } from "./cacheWriteWaste";
import { oneHourCache } from "./oneHourCache";
import { promptCaching } from "./promptCaching";
import { batch } from "./batch";

export const RULES: Rule[] = [
  // model stage: at most one model change per profile
  legacyModel,
  downgrade,
  // cache stage
  cacheWriteWaste,
  oneHourCache,
  promptCaching,
  // mode stage
  batch,
];
