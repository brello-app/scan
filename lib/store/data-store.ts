import { create } from "zustand";
import type { UsageRow } from "../data-normalizer";
import type { AnalysisWarning } from "../analysis";

export type DataSource = "sample" | "upload";

interface DataState {
  rows: UsageRow[];
  warnings: AnalysisWarning[];
  savedAt: string | null;
  source: DataSource;
  fileName: string | null;
  loadRows: (
    rows: UsageRow[],
    source: DataSource,
    fileName?: string | null,
  ) => void;
  setWarnings: (warnings: AnalysisWarning[]) => void;
  reset: () => void;
}

const initialState = {
  rows: [] as UsageRow[],
  warnings: [] as AnalysisWarning[],
  savedAt: null,
  source: "sample" as DataSource,
  fileName: null as string | null,
};

const useDataStore = create<DataState>()((set) => ({
  ...initialState,
  loadRows: (rows, source, fileName = null) =>
    set({
      rows,
      warnings: [],
      source,
      fileName,
      savedAt: new Date().toISOString(),
    }),
  setWarnings: (warnings) => set({ warnings }),
  reset: () => set(initialState),
}));

export default useDataStore;
