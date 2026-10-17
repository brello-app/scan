/** Add numeric values without allocating an intermediate array. */
export function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** Return the arithmetic mean; an empty set has no observations and returns zero. */
export function mean(values: readonly number[]): number {
  return values.length > 0 ? sum(values) / values.length : 0;
}

/** Return the median, using zero as the neutral result for an empty set. */
export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** Return the median absolute deviation scaled to a standard-deviation equivalent. */
export function robustStd(
  values: readonly number[],
  center = median(values),
): number {
  return median(values.map((value) => Math.abs(value - center))) * 1.4826;
}

/** Add whole UTC calendar days to an ISO date without local-time drift. */
export function addDays(date: string, amount: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

/** Count both endpoints in a UTC date range. */
export function daysBetween(start: string, end: string): number {
  const millisecondsPerDay = 86_400_000;
  return (
    Math.round(
      (Date.parse(`${end}T00:00:00.000Z`) -
        Date.parse(`${start}T00:00:00.000Z`)) /
        millisecondsPerDay,
    ) + 1
  );
}
