// Keeps parsed rows in sessionStorage so /report can read them after router.push.
// Cleared when the tab closes. Nothing leaves the browser.

import type { UsageRow } from "./data-normalizer";

const KEY = "brello-usage";

export type UsageSource = "upload" | "sample";
export type StoredUsage = {
  rows: UsageRow[];
  source: UsageSource;
  savedAt: number;
};

// Returns false if the browser refused (private mode, or the data is over the ~5MB limit).
export function saveUsage(rows: UsageRow[], source: UsageSource): boolean {
  try {
    const value: StoredUsage = { rows, source, savedAt: Date.now() };
    sessionStorage.setItem(KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Call only in the browser (inside useEffect or an event handler).
export function loadUsage(): StoredUsage | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUsage;
    return Array.isArray(parsed.rows) ? parsed : null;
  } catch {
    return null;
  }
}

export function clearUsage() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
