// Small display helpers shared by rules and the runner.
/** Format a dollar amount with fixed cents and US grouping. */
export const usd = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Format a token count with K/M suffixes for compact evidence rows. */
export const tok = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${Math.round(n)}`;

/** Format a decimal share as a whole-number percentage. */
export const pct = (n: number) => `${(n * 100).toFixed(0)}%`;

/** Format a unit price quoted per million tokens. */
export const perM = (n: number) => `$${n}/1M`;
