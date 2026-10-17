"use client";

import { useEffect } from "react";
import useDataStore from "@/lib/store/data-store";
import { ResultChart } from "./chart";
import { useAnalysis } from "../../lib/use-analysis";

export function AnalysisChart() {
  const setWarnings = useDataStore((state) => state.setWarnings);
  const analysis = useAnalysis();

  useEffect(() => {
    setWarnings(analysis.warnings);
  }, [analysis.warnings, setWarnings]);

  return <ResultChart daily={analysis.daily} />;
}
