"use client";

import useDataStore from "@/lib/store/data-store";
import { loadUsage } from "@/lib/usage-storage";
import { useEffect } from "react";

export function DataLoader() {
  const { loadRows } = useDataStore();
  useEffect(() => {
    const data = loadUsage();
    const fileName = data?.fileName?.trim() || "Filename unavailable";
    document.title = "Scan Result Report - " + fileName;
    if (!data) return;
    loadRows(data.rows, data.source, data.fileName);
  }, [loadRows]);
  return <></>;
}

