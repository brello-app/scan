// Turns OpenAI / Anthropic usage or cost CSV rows (already parsed by Papa.parse with header:true)
// into one common shape the report can work with.
//
// Supported formats (flattened from the official admin APIs):
//   openai_usage     input_tokens, output_tokens, num_model_requests, api_key_id ...
//   openai_costs     line_item, amount_value ...
//   anthropic_usage  uncached_input_tokens, cache_read_input_tokens, output_tokens ...
//   anthropic_costs  token_type, amount, cost_type ...
//
// What each format can give us (null / 0 = the format doesn't carry it):
//
//   field              openai_usage  openai_costs  anthropic_usage  anthropic_costs
//   apiKeyId                ✓             -              ✓                -
//   projectId / userId      ✓           project          -                -
//   workspaceId             -             -              ✓                ✓
//   token counts            ✓             -              ✓                -
//   cache write 5m / 1h     -             -              ✓          (via tokenType)
//   requests                ✓             -              -                -
//   serviceTier          batch flag   (line item)        ✓                ✓
//   contextWindow           -             -              ✓                ✓
//   cost                 computed      reported       computed         reported
//
// Usage files carry api_key_id (needed for leaked-key detection) but no money,
// so cost is computed from prices.json. Cost files carry money but no key.
// Any column we don't recognize is kept in `extra`, so nothing in the file is lost.

import prices from "./prices.json";

export type Provider = "openai" | "anthropic";
export type Format =
  | "openai_usage"
  | "openai_costs"
  | "anthropic_usage"
  | "anthropic_costs";

// Which kind of tokens a cost-file line is charging for.
export type TokenType =
  | "input"
  | "cache_read"
  | "cache_write_5m"
  | "cache_write_1h"
  | "output"
  | "web_search"
  | "other";

export type UsageRow = {
  // --- time --------------------------------------------------------------
  date: string; // YYYY-MM-DD (UTC) of the bucket start
  start: string | null; // ISO bucket start, keeps hourly/minute precision if the export has it
  end: string | null; // ISO bucket end

  // --- who / where ---------------------------------------------------------
  provider: Provider;
  format: Format; // which file this row came from
  model: string; // as written in the file, e.g. "gpt-5.4-2026-03-05"
  modelBase: string | null; // matched price-table key, e.g. "gpt-5.4"; null if unknown
  apiKeyId: string | null; // usage files only
  projectId: string | null; // OpenAI
  userId: string | null; // OpenAI
  workspaceId: string | null; // Anthropic
  accountId: string | null; // Anthropic
  serviceAccountId: string | null; // Anthropic

  // --- how it was served ---------------------------------------------------
  serviceTier: string | null; // "standard" | "batch" | "priority" | "flex" | ... as reported
  batch: boolean; // shortcut for serviceTier === "batch"
  contextWindow: string | null; // Anthropic: "0-200k" | "200k-1M"
  inferenceGeo: string | null; // Anthropic: "global" | "us" | ...

  // --- volume --------------------------------------------------------------
  inputTokens: number; // uncached input
  cacheReadTokens: number;
  cacheWrite5mTokens: number; // Anthropic only
  cacheWrite1hTokens: number; // Anthropic only
  cacheWriteTokens: number; // 5m + 1h, kept for convenience
  outputTokens: number;
  inputAudioTokens: number; // OpenAI only
  outputAudioTokens: number; // OpenAI only
  webSearchRequests: number; // Anthropic server tool use
  requests: number | null; // OpenAI usage only; Anthropic doesn't report it

  // --- money ---------------------------------------------------------------
  costUsd: number | null; // null when it had to be computed and the model isn't priced
  costSource: "computed" | "reported";
  tokenType: TokenType | null; // cost files: what this line charges for
  costType: string | null; // Anthropic cost files: "tokens" | "web_search" | ...
  description: string | null; // Anthropic cost files / OpenAI line_item as written

  // --- everything else -----------------------------------------------------
  extra: Record<string, string>; // unrecognized non-empty columns, kept verbatim
};

export type ParseResult =
  | { ok: true; format: Format; rows: UsageRow[]; warnings: string[] }
  | { ok: false; error: string };

type Raw = Record<string, string | undefined>;

// ---------------------------------------------------------------- detect ----

export function detectFormat(fields: string[]): Format | null {
  const f = new Set(fields.map((x) => x.trim()));
  if (f.has("uncached_input_tokens") && f.has("output_tokens"))
    return "anthropic_usage";
  if (f.has("token_type") && f.has("amount")) return "anthropic_costs";
  if (
    f.has("input_tokens") &&
    f.has("output_tokens") &&
    f.has("num_model_requests")
  )
    return "openai_usage";
  if (f.has("line_item") && f.has("amount_value")) return "openai_costs";
  return null;
}

// Columns each parser reads. Anything else goes into `extra`.
const KNOWN: Record<Format, string[]> = {
  openai_usage: [
    "start_time",
    "end_time",
    "start_time_iso",
    "end_time_iso",
    "project_id",
    "user_id",
    "api_key_id",
    "model",
    "batch",
    "service_tier",
    "input_tokens",
    "input_cached_tokens",
    "output_tokens",
    "input_audio_tokens",
    "output_audio_tokens",
    "num_model_requests",
    "object",
  ],
  openai_costs: [
    "start_time",
    "end_time",
    "start_time_iso",
    "end_time_iso",
    "project_id",
    "organization_id",
    "line_item",
    "amount_value",
    "amount_currency",
    "object",
  ],
  anthropic_usage: [
    "starting_at",
    "ending_at",
    "api_key_id",
    "workspace_id",
    "account_id",
    "service_account_id",
    "model",
    "service_tier",
    "context_window",
    "inference_geo",
    "speed",
    "uncached_input_tokens",
    "cache_creation_ephemeral_5m_input_tokens",
    "cache_creation_ephemeral_1h_input_tokens",
    "cache_read_input_tokens",
    "output_tokens",
    "web_search_requests",
  ],
  anthropic_costs: [
    "starting_at",
    "ending_at",
    "workspace_id",
    "model",
    "cost_type",
    "token_type",
    "service_tier",
    "context_window",
    "inference_geo",
    "description",
    "amount",
    "currency",
  ],
};

// --------------------------------------------------------------- helpers ----

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Empty strings and literal "null" become null.
const str = (v: string | undefined) => {
  const s = v?.trim();
  return s && s !== "null" ? s : null;
};

// Accepts unix seconds ("1789516800") or ISO ("2026-09-16T00:00:00Z").
function toIso(v: string | undefined): string | null {
  const s = str(v);
  if (!s) return null;
  const d = /^\d+$/.test(s) ? new Date(Number(s) * 1000) : new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function extraColumns(r: Raw, format: Format): Record<string, string> {
  const known = new Set(KNOWN[format]);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(r)) {
    const s = str(v);
    if (!known.has(k) && s) out[k] = s;
  }
  return out;
}

type OpenAIPrice = { input: number; cached_input: number; output: number };
type AnthropicPrice = {
  input: number;
  cache_write_5m: number;
  cache_write_1h: number;
  cache_read: number;
  output: number;
};

const OA = prices.openai as Record<string, OpenAIPrice>;
const AN = prices.anthropic as Record<string, AnthropicPrice>;
const M = 1_000_000;

// "gpt-5.4-2026-03-05" -> "gpt-5.4" ; "claude-sonnet-5-5-20260101" -> "claude-sonnet-5-5"
function matchModel(
  table: Record<string, unknown>,
  model: string,
): string | null {
  if (model in table) return model;
  const keys = Object.keys(table).sort((a, b) => b.length - a.length); // longest first
  return (
    keys.find((k) => model.startsWith(k + "-") || model.startsWith(k + "@")) ??
    null
  );
}

// Only standard and batch prices are in prices.json. Other tiers are priced at
// standard rates and flagged in warnings by normalize().
const tierDiscount = (tier: string | null) => (tier === "batch" ? 0.5 : 1);

// Base fields every row shares; parsers fill in the rest.
function baseRow(
  format: Format,
  provider: Provider,
  model: string,
  extra: Record<string, string>,
): UsageRow {
  return {
    date: "",
    start: null,
    end: null,
    provider,
    format,
    model,
    modelBase: null,
    apiKeyId: null,
    projectId: null,
    userId: null,
    workspaceId: null,
    accountId: null,
    serviceAccountId: null,
    serviceTier: null,
    batch: false,
    contextWindow: null,
    inferenceGeo: null,
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWrite5mTokens: 0,
    cacheWrite1hTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    inputAudioTokens: 0,
    outputAudioTokens: 0,
    webSearchRequests: 0,
    requests: null,
    costUsd: null,
    costSource: "computed",
    tokenType: null,
    costType: null,
    description: null,
    extra,
  };
}

// ----------------------------------------------------------------- parse ----

function fromOpenAIUsage(r: Raw): UsageRow | null {
  const start = toIso(r.start_time_iso) ?? toIso(r.start_time);
  const model = str(r.model);
  if (!start || !model) return null;

  const input = num(r.input_tokens); // OpenAI reports total input, cached included
  const cached = num(r.input_cached_tokens);
  const output = num(r.output_tokens);
  const tier = str(r.service_tier) ?? (r.batch === "true" ? "batch" : null);
  const base = matchModel(OA, model);
  const p = base ? OA[base] : null;
  const cost = p
    ? (((input - cached) * p.input +
        cached * p.cached_input +
        output * p.output) /
        M) *
      tierDiscount(tier)
    : null;

  return {
    ...baseRow(
      "openai_usage",
      "openai",
      model,
      extraColumns(r, "openai_usage"),
    ),
    date: start.slice(0, 10),
    start,
    end: toIso(r.end_time_iso) ?? toIso(r.end_time),
    modelBase: base,
    apiKeyId: str(r.api_key_id),
    projectId: str(r.project_id),
    userId: str(r.user_id),
    serviceTier: tier,
    batch: tier === "batch",
    inputTokens: input - cached,
    cacheReadTokens: cached,
    outputTokens: output,
    inputAudioTokens: num(r.input_audio_tokens),
    outputAudioTokens: num(r.output_audio_tokens),
    requests: num(r.num_model_requests),
    costUsd: cost,
  };
}

// line_item looks like "gpt-5.4, input" / "gpt-5.4, cached input" / "gpt-5.4, output"
function openAITokenType(kind: string): TokenType {
  const k = kind.toLowerCase();
  if (k.includes("cached")) return "cache_read";
  if (k.includes("input")) return "input";
  if (k.includes("output")) return "output";
  return "other";
}

function fromOpenAICost(r: Raw): UsageRow | null {
  const start = toIso(r.start_time_iso) ?? toIso(r.start_time);
  const lineItem = str(r.line_item);
  if (!start || !lineItem) return null;

  const [model, kind = ""] = lineItem.split(",").map((s) => s.trim());
  const isBatch = /batch/i.test(kind);

  return {
    ...baseRow(
      "openai_costs",
      "openai",
      model,
      extraColumns(r, "openai_costs"),
    ),
    date: start.slice(0, 10),
    start,
    end: toIso(r.end_time_iso) ?? toIso(r.end_time),
    modelBase: matchModel(OA, model),
    projectId: str(r.project_id),
    serviceTier: isBatch ? "batch" : null,
    batch: isBatch,
    costUsd: num(r.amount_value),
    costSource: "reported",
    tokenType: openAITokenType(kind),
    description: lineItem,
  };
}

function fromAnthropicUsage(r: Raw): UsageRow | null {
  const start = toIso(r.starting_at);
  const model = str(r.model);
  if (!start || !model) return null;

  const input = num(r.uncached_input_tokens);
  const read = num(r.cache_read_input_tokens);
  const w5 = num(r.cache_creation_ephemeral_5m_input_tokens);
  const w1h = num(r.cache_creation_ephemeral_1h_input_tokens);
  const output = num(r.output_tokens);
  const tier = str(r.service_tier);
  const base = matchModel(AN, model);
  const p = base ? AN[base] : null;
  const cost = p
    ? ((input * p.input +
        read * p.cache_read +
        w5 * p.cache_write_5m +
        w1h * p.cache_write_1h +
        output * p.output) /
        M) *
      tierDiscount(tier)
    : null;

  return {
    ...baseRow(
      "anthropic_usage",
      "anthropic",
      model,
      extraColumns(r, "anthropic_usage"),
    ),
    date: start.slice(0, 10),
    start,
    end: toIso(r.ending_at),
    modelBase: base,
    apiKeyId: str(r.api_key_id),
    workspaceId: str(r.workspace_id),
    accountId: str(r.account_id),
    serviceAccountId: str(r.service_account_id),
    serviceTier: tier,
    batch: tier === "batch",
    contextWindow: str(r.context_window),
    inferenceGeo: str(r.inference_geo),
    inputTokens: input,
    cacheReadTokens: read,
    cacheWrite5mTokens: w5,
    cacheWrite1hTokens: w1h,
    cacheWriteTokens: w5 + w1h,
    outputTokens: output,
    webSearchRequests: num(r.web_search_requests),
    costUsd: cost,
  };
}

// token_type looks like "uncached_input_tokens" / "cache_creation.ephemeral_5m_input_tokens" / ...
function anthropicTokenType(
  tokenType: string | null,
  costType: string | null,
): TokenType {
  const t = tokenType ?? "";
  if (t.includes("ephemeral_5m")) return "cache_write_5m";
  if (t.includes("ephemeral_1h")) return "cache_write_1h";
  if (t.includes("cache_read")) return "cache_read";
  if (t.includes("uncached_input") || t === "input_tokens") return "input";
  if (t.includes("output")) return "output";
  if (costType === "web_search") return "web_search";
  return "other";
}

function fromAnthropicCost(r: Raw): UsageRow | null {
  const start = toIso(r.starting_at);
  const model = str(r.model);
  if (!start || !model) return null;

  const tier = str(r.service_tier);
  const costType = str(r.cost_type);

  return {
    ...baseRow(
      "anthropic_costs",
      "anthropic",
      model,
      extraColumns(r, "anthropic_costs"),
    ),
    date: start.slice(0, 10),
    start,
    end: toIso(r.ending_at),
    modelBase: matchModel(AN, model),
    workspaceId: str(r.workspace_id),
    serviceTier: tier,
    batch: tier === "batch",
    contextWindow: str(r.context_window),
    inferenceGeo: str(r.inference_geo),
    costUsd: num(r.amount),
    costSource: "reported",
    tokenType: anthropicTokenType(str(r.token_type), costType),
    costType,
    description: str(r.description),
  };
}

const PARSERS: Record<Format, (r: Raw) => UsageRow | null> = {
  openai_usage: fromOpenAIUsage,
  openai_costs: fromOpenAICost,
  anthropic_usage: fromAnthropicUsage,
  anthropic_costs: fromAnthropicCost,
};

export function normalize(data: Raw[], fields: string[]): ParseResult {
  const format = detectFormat(fields);
  if (!format) {
    return {
      ok: false,
      error:
        "Unrecognized CSV. Export usage or cost data from the OpenAI or Anthropic console and try again.",
    };
  }

  const rows: UsageRow[] = [];
  let skipped = 0;
  const unpriced = new Set<string>();
  const oddTiers = new Set<string>();
  let longContext = false;
  let audio = false;
  let webSearch = false;
  const currencies = new Set<string>();

  for (const r of data) {
    const row = PARSERS[format](r);
    if (!row) {
      skipped++;
      continue;
    }
    if (row.costSource === "computed") {
      if (row.costUsd === null) unpriced.add(row.model);
      if (
        row.serviceTier &&
        row.serviceTier !== "standard" &&
        row.serviceTier !== "batch"
      )
        oddTiers.add(row.serviceTier);
      if (row.contextWindow && row.contextWindow !== "0-200k")
        longContext = true;
      if (row.inputAudioTokens || row.outputAudioTokens) audio = true;
      if (row.webSearchRequests) webSearch = true;
    }
    const cur = str(r.amount_currency) ?? str(r.currency);
    if (cur) currencies.add(cur.toLowerCase());
    rows.push(row);
  }

  const warnings: string[] = [];
  if (skipped)
    warnings.push(`${skipped} row(s) skipped (missing date or model).`);
  if (unpriced.size)
    warnings.push(
      `No price for: ${[...unpriced].join(", ")}. Their cost is left out of totals.`,
    );
  if (oddTiers.size)
    warnings.push(
      `${[...oddTiers].join(", ")} tier usage is priced at standard rates, so its cost is an estimate.`,
    );
  if (longContext)
    warnings.push(
      "Long-context (200k+) usage is priced at standard rates, so its cost may be understated.",
    );
  if (audio)
    warnings.push("Audio tokens aren't priced yet and are left out of totals.");
  if (webSearch)
    warnings.push(
      "Web search requests aren't priced yet and are left out of totals.",
    );
  if ([...currencies].some((c) => c !== "usd"))
    warnings.push(`Non-USD currency found: ${[...currencies].join(", ")}.`);
  if (format.endsWith("_costs"))
    warnings.push(
      "Cost files don't include API keys or token counts. Key-level alerts need the usage export; spend spikes can still be flagged.",
    );
  if (!rows.length)
    return { ok: false, error: "No usable rows found in this file." };

  return { ok: true, format, rows, warnings };
}
