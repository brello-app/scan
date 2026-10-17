"use client";

import { useRef } from "react";
import { AnimatedBeam } from "@/components/ui/animated-beam";

export function ModelSwitchVisual() {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentModelRef = useRef<HTMLDivElement>(null);
  const suggestedModelRef = useRef<HTMLDivElement>(null);

  return (
    <div className="mt-auto rounded-xl border border-border bg-background p-4">
      <div className="mb-3 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <span>Simple summaries</span>
        <span>Model fit</span>
      </div>
      <div
        ref={containerRef}
        className="relative grid grid-cols-2 items-center gap-3"
      >
        <div
          ref={currentModelRef}
          className="relative z-10 rounded-lg border border-border bg-card px-3 py-3 shadow-sm"
        >
          <p className="text-[10px] text-muted-foreground">Current</p>
          <p className="mt-1 text-sm font-semibold">gpt-5.5</p>
        </div>
        <div
          ref={suggestedModelRef}
          className="relative z-10 rounded-lg border border-primary/40 bg-card px-3 py-3 shadow-sm"
        >
          <p className="text-[10px] text-primary">Suggested</p>
          <p className="mt-1 text-sm font-semibold">gpt-5.4-mini</p>
        </div>
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={currentModelRef}
          toRef={suggestedModelRef}
          duration={3}
          pathColor="var(--border)"
          gradientStartColor="#818cf8"
          gradientStopColor="#c4b5fd"
        />
      </div>
    </div>
  );
}
