// Keeps parsed rows and the source filename in sessionStorage for the /result route.
// Cleared when the tab closes. Nothing leaves the browser.

import type { UsageRow } from "./data-normalizer";

const KEY = "brello-usage";

export type UsageSource = "upload" | "sample";
export type StoredUsage = {
  rows: UsageRow[];
  source: UsageSource;
  savedAt: number;
  fileName: string | null;
};

// Returns false if the browser refused (private mode, or the data is over the ~5MB limit).
export function saveUsage(
  rows: UsageRow[],
  source: UsageSource,
  fileName: string | null = null,
): boolean {
  try {
    const value: StoredUsage = {
      rows,
      source,
      savedAt: Date.now(),
      fileName,
    };
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

    const parsed = JSON.parse(raw) as Partial<StoredUsage>;
    if (!Array.isArray(parsed.rows)) return null;

    return {
      rows: parsed.rows as UsageRow[],
      source: parsed.source === "upload" ? "upload" : "sample",
      savedAt:
        typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now(),
      fileName:
        typeof parsed.fileName === "string" && parsed.fileName.trim()
          ? parsed.fileName
          : null,
    };
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

