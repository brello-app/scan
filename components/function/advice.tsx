"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import { cn } from "cn";
import { BrelloLogo } from "../brand/brello-logo";
import type { Advice, AdviceResult } from "@/lib/analysis/advice/types";
import { useAdvice } from "../../lib/use-advice";

function formatDollars(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(date: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(date + "T00:00:00.000Z"));
}

function AdviceItem({ advice }: { advice: Advice }) {
  const [open, setOpen] = useState(false);
  const detailsId = "advice-" + advice.id.replace(/[^a-zA-Z0-9_-]/g, "-");
  const isSave = advice.section === "save";

  return (
    <article>
      <button
        type="button"
        className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left"
        aria-expanded={open}
        aria-controls={detailsId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="text-lg font-semibold sm:text-2xl">
          {advice.title}
        </span>
        <span className="flex shrink-0 items-center gap-3 sm:gap-5">
          <span className="flex flex-col items-end">
            <span className="text-xs text-muted-foreground sm:text-sm">
              {isSave ? "Ways to Save" : "Worth Checking"}
            </span>
            <span
              className={cn(
                "text-xl font-bold tabular-nums sm:text-3xl",
                isSave ? "text-green-500" : "text-amber-400",
              )}
            >
              {formatDollars(advice.monthlySavingsUsd)}
              <span className="text-xs font-medium sm:text-sm">/mo</span>
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-6 text-foreground/50 transition-transform sm:size-8",
              open && "rotate-180",
            )}
          />
        </span>
      </button>
      <div
        id={detailsId}
        hidden={!open}
        className="grid gap-5 px-2 pb-7 sm:px-5"
      >
        <p className="text-muted-foreground">{advice.why}</p>

        {advice.steps.length > 0 && (
          <dl className="grid gap-2 rounded-xl bg-muted/40 p-4 sm:grid-cols-2">
            {advice.steps.map((step, index) => (
              <div
                key={`${step.label}-${index}`}
                className="flex items-start justify-between gap-4 text-sm"
              >
                <dt className="text-muted-foreground">{step.label}</dt>
                <dd className="text-right font-medium tabular-nums">
                  {step.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div>
          <p className="mb-1 font-semibold">What to do</p>
          <p className="text-sm text-muted-foreground">{advice.howTo}</p>
        </div>

        {advice.caveat && (
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">
              Keep in mind:{" "}
            </span>
            {advice.caveat}
          </p>
        )}

        {advice.assumptions.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold">Assumptions</p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {advice.assumptions.map((assumption) => (
                <li key={assumption}>{assumption}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 gap-y-2 text-xs text-muted-foreground mb-5">
          <span>
            {advice.confidence === "high"
              ? "High confidence"
              : advice.confidence === "medium"
                ? "Medium confidence"
                : "Needs review"}
          </span>
          {advice.docsUrl && (
            <a
              className="inline-flex items-center gap-1 text-primary hover:underline"
              href={advice.docsUrl}
              target="_blank"
              rel="noreferrer"
            >
              Documentation <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function AdviceSection({
  title,
  items,
  note,
}: {
  title: string;
  items: Advice[];
  note?: string;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-6">
      {note && <p className="mb-1 text-sm text-muted-foreground">{note}</p>}
      <h3 className="text-lg font-semibold">{title}</h3>
      <div>
        {items.map((advice, index) => (
          <div key={advice.id}>
            {index > 0 && (
              <div role="separator" className="h-px w-full bg-border" />
            )}
            <AdviceItem advice={advice} />
          </div>
        ))}
      </div>
    </section>
  );
}

function CouldNotCheck({ result }: { result: AdviceResult }) {
  if (result.couldntCheck.length === 0) return null;

  return (
    <section className="mt-8 rounded-xl border border-border p-5">
      <h3 className="font-semibold">Couldn’t check yet</h3>
      <ul className="mt-3 grid gap-3">
        {result.couldntCheck.map((item) => (
          <li
            key={`${item.ruleId}-${item.provider}`}
            className="text-sm text-muted-foreground"
          >
            <span className="font-medium capitalize text-foreground">
              {item.provider}: {item.models.join(", ")}
            </span>
            <span className="block">{item.reason}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function BrelloAdvise() {
  const advice = useAdvice();
  const result = advice?.result ?? null;
  const waysToSave = result
    ? [
        ...result.waysToSave,
        ...result.hidden.filter((item) => item.section === "save"),
      ].sort((a, b) => b.monthlySavingsUsd - a.monthlySavingsUsd)
    : [];
  const worthChecking = result
    ? [
        ...result.worthChecking,
        ...result.hidden.filter((item) => item.section === "check"),
      ].sort((a, b) => b.monthlySavingsUsd - a.monthlySavingsUsd)
    : [];
  const recommendationsExist =
    waysToSave.length > 0 || worthChecking.length > 0;

  return (
    <div className="pt-10">
      <div className="flex items-end py-5 text-3xl font-semibold select-none">
        <BrelloLogo className="mb-0.5 w-22" />
        <h2 className="-mb-1">&apos;s Advice</h2>
      </div>

      {advice && (
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Based on {formatShortDate(advice.startDate)} –{" "}
            {formatShortDate(advice.endDate)} ({advice.days}{" "}
            {advice.days === 1 ? "day" : "days"}) · suspicious spend excluded
          </p>
        </div>
      )}

      {result ? (
        <>
          {recommendationsExist ? (
            <>
              <AdviceSection title="Ways to save" items={waysToSave} />
              <AdviceSection
                title="Worth checking"
                note="Not counted in the total"
                items={worthChecking}
              />
            </>
          ) : (
            <p className="mt-6 rounded-xl border border-border p-5 text-sm text-muted-foreground">
              No Advice
            </p>
          )}
          <CouldNotCheck result={result} />
        </>
      ) : (
        <p className="rounded-xl border border-border p-5 text-sm text-muted-foreground">
          Upload a usage or cost export to get recommendations based on your
          spending.
        </p>
      )}
    </div>
  );
}
