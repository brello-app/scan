import { Database, Layers, Zap } from "lucide-react";
import { ModelSwitchVisual } from "@/components/function/model-switch-visual";
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid";

export function WhatBrelloFind() {
  return (
    <section className="my-32 px-5" aria-labelledby="what-brello-finds-title">
      <div className="mx-auto max-w-300">
        <div className="mx-auto max-w-3xl text-center">
          <h2
            id="what-brello-finds-title"
            className="mt-5 text-4xl font-black tracking-tight sm:text-5xl"
          >
            What Brello finds
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            A sample scan can surface expensive model choices, suspicious spend,
            and discounts your usage may be missing.
          </p>
        </div>

        <BentoGrid className="mt-10">
          <BentoCard id="overpriced-models" className="scroll-mt-24">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-sm font-medium">
                1
              </span>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">
                  Overpriced models
                </h3>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  gpt-5.5 on simple summaries could use a smaller model.
                </p>
              </div>
            </div>
            <ModelSwitchVisual />
          </BentoCard>

          <BentoCard id="suspicious-spikes" className="scroll-mt-24">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-sm font-medium">
                2
              </span>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">
                  Suspicious spikes
                </h3>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  A sudden bill jump tied to a key you may not recognize.
                </p>
              </div>
            </div>
            <div className="relative mt-auto overflow-hidden rounded-xl border border-border bg-background p-4">
              <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-lg border border-destructive/30 bg-card px-3 py-2 shadow-md">
                <Zap className="size-4 text-destructive" aria-hidden="true" />
                <div>
                  <p className="text-[10px] text-muted-foreground">
                    Unknown key · 1 day
                  </p>
                  <p className="text-sm font-bold text-destructive">$1,112</p>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="flex h-24 items-end gap-2 border-b border-border px-2 pt-5"
              >
                <span className="h-5 flex-1 rounded-t bg-muted-foreground/25" />
                <span className="h-7 flex-1 rounded-t bg-muted-foreground/25" />
                <span className="h-6 flex-1 rounded-t bg-muted-foreground/25" />
                <span className="h-8 flex-1 rounded-t bg-muted-foreground/25" />
                <span className="h-6 flex-1 rounded-t bg-muted-foreground/25" />
                <span className="h-20 flex-1 rounded-t bg-destructive" />
              </div>
              <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Daily API spend
              </p>
            </div>
          </BentoCard>

          <BentoCard id="missed-discounts" className="scroll-mt-24">
            <div className="flex items-start gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-background text-sm font-medium">
                3
              </span>
              <div>
                <h3 className="text-xl font-semibold tracking-tight">
                  Missed discounts
                </h3>
                <p className="mt-2 text-sm leading-5 text-muted-foreground">
                  Prompt caching and Batch aren’t being used in this sample.
                </p>
              </div>
            </div>
            <div className="mt-auto space-y-2 rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3 shadow-sm">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Database
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Prompt caching
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  Not used
                </span>
              </div>
              <div className="ml-5 flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-3 shadow-sm">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <Layers
                    className="size-4 text-muted-foreground"
                    aria-hidden="true"
                  />
                  Batch
                </span>
                <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                  Not used
                </span>
              </div>
            </div>
          </BentoCard>
        </BentoGrid>
      </div>
    </section>
  );
}
