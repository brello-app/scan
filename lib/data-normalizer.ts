// Turns OpenAI / Anthropic usage or cost CSV rows (already parsed by Papa.parse with header:true)
// into one common shape the report can work with.
//
// Supported formats (flattened from the official admin APIs):
//   openai_usage     input_tokens, output_tokens, num_model_requests, api_key_id ...
//   openai_costs     line_item, amount_value ...
//   anthropic_usage  uncached_input_tokens, cache_read_input_tokens, output_tokens ...
//   anthropic_costs  token_type, amount, cost_type ...
//
// Usage files carry api_key_id (needed for leaked-key detection) but no money,
// so cost is computed from prices.json. Cost files carry money but no key.

import prices from "./prices.json";

export type Provider = "openai" | "anthropic";
export type Format =
  | "openai_usage"
  | "openai_costs"
  | "anthropic_usage"
  | "anthropic_costs";

export type UsageRow = {
  date: string; // YYYY-MM-DD (UTC)
  provider: Provider;
  model: string;
  apiKeyId: string | null; // null for cost files
  batch: boolean;
  inputTokens: number; // uncached input
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  requests: number | null;
  costUsd: number | null; // null when the model isn't in prices.json
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

// --------------------------------------------------------------- helpers ----

const num = (v: string | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Accepts unix seconds ("1789516800") or ISO ("2026-09-16T00:00:00Z").
function toDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  const d = /^\d+$/.test(s) ? new Date(Number(s) * 1000) : new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
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
function findPrice<T>(table: Record<string, T>, model: string): T | null {
  if (table[model]) return table[model];
  const keys = Object.keys(table).sort((a, b) => b.length - a.length); // longest first
  const hit = keys.find(
    (k) => model.startsWith(k + "-") || model.startsWith(k + "@"),
  );
  return hit ? table[hit] : null;
}

// ----------------------------------------------------------------- parse ----

function fromOpenAIUsage(r: Raw): UsageRow | null {
  const date = toDate(r.start_time_iso) ?? toDate(r.start_time);
  if (!date || !r.model) return null;
  const input = num(r.input_tokens);
  const cached = num(r.input_cached_tokens);
  const output = num(r.output_tokens);
  const batch = r.batch === "true";
  const p = findPrice(OA, r.model);
  const discount = batch ? 0.5 : 1;
  const cost = p
    ? (((input - cached) * p.input +
        cached * p.cached_input +
        output * p.output) /
        M) *
      discount
    : null;
  return {
    date,
    provider: "openai",
    model: r.model,
    apiKeyId: r.api_key_id || null,
    batch,
    inputTokens: input - cached,
    cacheReadTokens: cached,
    cacheWriteTokens: 0,
    outputTokens: output,
    requests: num(r.num_model_requests),
    costUsd: cost,
  };
}

// line_item looks like "gpt-5.4, input" / "gpt-5.4, cached input" / "gpt-5.4, output"
function fromOpenAICost(r: Raw): UsageRow | null {
  const date = toDate(r.start_time_iso) ?? toDate(r.start_time);
  if (!date || !r.line_item) return null;
  const [model, kind = ""] = r.line_item.split(",").map((s) => s.trim());
  return {
    date,
    provider: "openai",
    model,
    apiKeyId: null,
    batch: /batch/i.test(kind),
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    requests: null,
    costUsd: num(r.amount_value),
  };
}

function fromAnthropicUsage(r: Raw): UsageRow | null {
  const date = toDate(r.starting_at);
  if (!date || !r.model) return null;
  const input = num(r.uncached_input_tokens);
  const read = num(r.cache_read_input_tokens);
  const w5 = num(r.cache_creation_ephemeral_5m_input_tokens);
  const w1h = num(r.cache_creation_ephemeral_1h_input_tokens);
  const output = num(r.output_tokens);
  const batch = r.service_tier === "batch";
  const p = findPrice(AN, r.model);
  const discount = batch ? 0.5 : 1;
  const cost = p
    ? ((input * p.input +
        read * p.cache_read +
        w5 * p.cache_write_5m +
        w1h * p.cache_write_1h +
        output * p.output) /
        M) *
      discount
    : null;
  return {
    date,
    provider: "anthropic",
    model: r.model,
    apiKeyId: r.api_key_id || null,
    batch,
    inputTokens: input,
    cacheReadTokens: read,
    cacheWriteTokens: w5 + w1h,
    outputTokens: output,
    requests: null,
    costUsd: cost,
  };
}

function fromAnthropicCost(r: Raw): UsageRow | null {
  const date = toDate(r.starting_at);
  if (!date || !r.model) return null;
  return {
    date,
    provider: "anthropic",
    model: r.model,
    apiKeyId: null,
    batch: r.service_tier === "batch",
    inputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    outputTokens: 0,
    requests: null,
    costUsd: num(r.amount),
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

  for (const r of data) {
    const row = PARSERS[format](r);
    if (!row) {
      skipped++;
      continue;
    }
    if (row.costUsd === null) unpriced.add(row.model);
    rows.push(row);
  }

  const warnings: string[] = [];
  if (skipped)
    warnings.push(`${skipped} row(s) skipped (missing date or model).`);
  if (unpriced.size)
    warnings.push(
      `No price for: ${[...unpriced].join(", ")}. Their cost is left out of totals.`,
    );
  if (format.endsWith("_costs"))
    warnings.push(
      "Cost files don't include API keys, so leaked-key detection needs the usage export.",
    );
  if (!rows.length)
    return { ok: false, error: "No usable rows found in this file." };

  return { ok: true, format, rows, warnings };
}
