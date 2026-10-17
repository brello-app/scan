"use client";

import { AlertBanner } from "@/components/ui/alert-banner";
import useDataStore from "@/lib/store/data-store";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00.000Z"));
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate + "T00:00:00.000Z");
  const end = new Date(endDate + "T00:00:00.000Z");
  const sameMonth =
    start.getUTCFullYear() === end.getUTCFullYear() &&
    start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth) {
    return (
      formatDate(startDate).replace(/ \d+$/, "") +
      " " +
      start.getUTCDate() +
      "–" +
      end.getUTCDate()
    );
  }

  return formatDate(startDate) + "–" + formatDate(endDate);
}

function maskApiKey(apiKeyId: string): string {
  if (apiKeyId.length <= 12) return apiKeyId;
  return apiKeyId.slice(0, 8) + "…" + apiKeyId.slice(-4);
}

export function AnalysisAlertBanner() {
  const warnings = useDataStore((state) => state.warnings);
  if (warnings.length === 0) return null;

  return (
    <>
      {warnings.map((warning) => {
        const days = warning.activeDays;
        const duration = days + (days === 1 ? " day" : " days");
        const models =
          warning.models.length > 0
            ? warning.models.join(", ")
            : "unknown model";
        const sharePercent = Math.round(warning.shareOfBill * 100);
        const title =
          warning.type === "unfamiliar-api-key"
            ? "An unfamiliar API key spent " +
              formatCurrency(warning.amountUsd) +
              " in " +
              duration
            : "Unusual spend detected: " +
              formatCurrency(warning.amountUsd) +
              " in " +
              duration;
        const contents =
          warning.type === "unfamiliar-api-key"
            ? maskApiKey(warning.apiKeyId) +
              " · " +
              formatDateRange(warning.startDate, warning.endDate) +
              " · " +
              models +
              " · That’s " +
              sharePercent +
              "% of your total bill."
            : warning.provider +
              " · " +
              formatDateRange(warning.startDate, warning.endDate) +
              " · " +
              models +
              " · " +
              warning.description +
              " · That’s " +
              sharePercent +
              "% of your total bill.";

        return (
          <AlertBanner
            key={warning.id}
            title={title}
            contents={contents}
            provider={warning.provider}
          />
        );
      })}
    </>
  );
}
