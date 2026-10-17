"use client";

import useDataStore from "@/lib/store/data-store";
import Link from "next/link";

export function SampleNotification() {
  const { source } = useDataStore();
  if (source !== "sample") return <></>;
  return (
    <div className="w-full h-fit bg-primary text-primary-foreground mb-5">
      <div className="max-w-300 mx-auto p-3 flex justify-between items-center">
        <p className="font-semibold">
          {" "}
          👀 Demo data — This is a sample data with a leaked key. See what
          Brello finds in yours →
        </p>
        <Link
          className="border border-primary-foreground py-1 px-8 text-sm font-bold"
          href={"/"}
        >
          Upload CSV
        </Link>
      </div>
    </div>
  );
}
