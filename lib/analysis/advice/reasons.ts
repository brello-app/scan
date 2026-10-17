import type { Profile } from "./types";

/** Explain why request-count recommendations are unavailable for a profile. */
export function missingRequestCountReason(profile: Profile): string {
  if (profile.provider === "anthropic") {
    return "Anthropic doesn’t report request counts, so request-based recommendations aren’t available.";
  }

  if (profile.source === "cost") {
    return "This cost export doesn’t include request counts. Upload the usage export to check this recommendation.";
  }

  return "Request counts aren’t available in this data.";
}
