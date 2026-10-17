import type { Metadata } from "next";
import { BrelloAdvise } from "@/components/function/advice";
import { AnalysisAlertBanner } from "@/components/function/analysis-alert-banner";
import { AnalysisChart } from "@/components/function/analysis-chart";
import { DataLoader } from "@/components/function/data-loader";
import { ResultKPIs } from "@/components/function/result-kpis";
import { CTA } from "@/components/function/cta";
import { SampleNotification } from "@/components/ui/sample-notification";

export const metadata: Metadata = {
  title: { absolute: "Scan Result Report - Filename unavailable" },
  description:
    "Review a local report of AI API usage, spending changes, and detected spikes.",
  robots: { index: false, follow: false },
};

export default function ResultPage() {
  return (
    <main className="my-20 relative">
      <SampleNotification />
      <div className="max-w-300 w-full mx-auto">
        <DataLoader />
        <AnalysisAlertBanner />
        <ResultKPIs />
        <AnalysisChart />
        <BrelloAdvise />
        <CTA />
      </div>
    </main>
  );
}
