"use client";

import { ExternalLink } from "lucide-react";
import { Tabs } from "@base-ui/react/tabs";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { BrelloScanLogo } from "../brand/brello-scan-logo";

const tabs = [
  { value: "export", label: "Export" },
  { value: "upload", label: "Upload" },
  { value: "privacy", label: "Privacy" },
  { value: "report", label: "Report" },
] as const;

const tabClassName =
  "group flex min-w-[9rem] flex-1 items-center justify-center gap-2.5 border-b-2 border-transparent px-3 py-3 text-sm font-medium text-muted-foreground data-[active]:border-primary data-[active]:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:min-w-0";

function ProviderGuideLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
    >
      {children}
      <ExternalLink className="size-3.5" aria-hidden="true" />
    </a>
  );
}

export function HowBrelloWorks() {
  return (
    <section className="my-32 px-5" aria-labelledby="how-brello-works-title">
      <div className="mx-auto max-w-300">
        <div className="mx-auto max-w-3xl text-center">
          <div
            id="how-brello-works-title"
            className="mt-5 text-4xl font-black tracking-tight sm:text-5xl flex items-end justify-center gap-5 select-none"
          >
            <p className="-mb-1.75">How</p> <BrelloScanLogo className="w-56" />{" "}
            <p className="-mb-1.75">works</p>
          </div>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
            From your CSV to a clear picture of your AI spend.
          </p>
        </div>

        <Tabs.Root defaultValue="export" className="mt-9">
          <div className="-mx-5 overflow-x-auto px-5 pb-1 md:mx-0 md:overflow-visible md:px-0">
            <Tabs.List
              aria-label="How Brello works"
              activateOnFocus
              className="flex min-w-xl border-b border-border md:min-w-0"
            >
              {tabs.map((tab, index) => (
                <Tabs.Tab
                  key={tab.value}
                  value={tab.value}
                  className={tabClassName}
                >
                  <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border text-xs tabular-nums text-muted-foreground group-data-active:border-primary group-data-active:bg-primary group-data-active:text-primary-foreground">
                    {index + 1}
                  </span>
                  <span>{tab.label}</span>
                </Tabs.Tab>
              ))}
            </Tabs.List>
          </div>

          <Tabs.Panel
            value="export"
            className="mt-6 focus-visible:outline-none"
          >
            <Card className="min-h-76 justify-between sm:min-h-80">
              <CardHeader>
                <h3 className="text-xl font-semibold tracking-tight">
                  Export a usage CSV
                </h3>
                <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                  Download a CSV from your provider’s Usage page. Usage exports
                  give Brello more detail, and cost exports are supported too.
                </p>
              </CardHeader>
              <CardContent className="mt-auto flex flex-wrap gap-x-6 gap-y-3 pt-5">
                <ProviderGuideLink href="https://help.openai.com/en/articles/20001072">
                  OpenAI export guide
                </ProviderGuideLink>
                <ProviderGuideLink href="https://support.anthropic.com/en/articles/9534590-cost-and-usage-reporting-in-console">
                  Anthropic export guide
                </ProviderGuideLink>
              </CardContent>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel
            value="upload"
            className="mt-6 focus-visible:outline-none"
          >
            <Card className="min-h-76 justify-between sm:min-h-80">
              <CardHeader>
                <h3 className="text-xl font-semibold tracking-tight">
                  Drop your CSV into Brello
                </h3>
                <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                  Drag a CSV into the scanner, or choose a file from your
                  device.
                </p>
              </CardHeader>
              <CardContent className="mt-auto pt-5">
                <a
                  href="#scanner"
                  className={buttonVariants({ variant: "outline", size: "lg" })}
                >
                  Go to the scanner
                </a>
              </CardContent>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel
            value="privacy"
            className="mt-6 focus-visible:outline-none"
          >
            <Card className="min-h-76 justify-between sm:min-h-80">
              <CardHeader>
                <h3 className="text-xl font-semibold tracking-tight">
                  Your data stays on your device
                </h3>
                <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                  Your CSV is analyzed in your browser. Brello does not send
                  your file or usage data to a server.
                </p>
              </CardHeader>
              <CardContent className="mt-auto pt-5">
                <ProviderGuideLink href="https://github.com/brello-app/brello-scan">
                  View source on GitHub
                </ProviderGuideLink>
              </CardContent>
            </Card>
          </Tabs.Panel>

          <Tabs.Panel
            value="report"
            className="mt-6 focus-visible:outline-none"
          >
            <Card className="min-h-76 justify-between sm:min-h-[20rem">
              <CardHeader>
                <h3 className="text-xl font-semibold tracking-tight">
                  Review your scan report
                </h3>
                <p className="text-sm leading-6 text-muted-foreground sm:text-base">
                  See suspicious spikes, expensive model choices, and potential
                  savings in one report.
                </p>
              </CardHeader>
            </Card>
          </Tabs.Panel>
        </Tabs.Root>
      </div>
    </section>
  );
}
