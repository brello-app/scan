"use client";

import { useCallback, useMemo } from "react";
import {
  Bar,
  BarShapeProps,
  CartesianGrid,
  ComposedChart,
  Rectangle,
  XAxis,
  YAxis,
} from "recharts";
import { ChartConfig, ChartContainer, ChartTooltip } from "../ui/chart";
import type { AnalysisDailyPoint } from "@/lib/analysis";

export const chartConfig = {
  tokens: { label: "Tokens", color: "var(--primary)" },
  normal: { label: "Normal", color: "var(--muted-foreground)" },
  expected: { label: "Expected spike", color: "var(--color-green-500)" },
  suspicious: { label: "Suspicious spike", color: "var(--color-red-500)" },
} satisfies ChartConfig;

type ChartPoint = AnalysisDailyPoint & { label: string };
type UsageTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: ChartPoint }>;
};

const BAR_FILL = {
  normal: "var(--color-normal)",
  good: "var(--color-expected)",
  bad: "var(--color-suspicious)",
} as const;

function getAxisMax(daily: readonly AnalysisDailyPoint[]): number {
  const maxCost = Math.max(0, ...daily.map((point) => point.cost));
  const normalMax = Math.max(
    0,
    ...daily.filter((point) => point.spike === null).map((point) => point.cost),
  );
  const hasSpike = daily.some((point) => point.spike !== null);

  if (normalMax > 0 && hasSpike) return normalMax * 3;
  return Math.max(maxCost * 1.1, 1);
}
function toChartData(daily: readonly AnalysisDailyPoint[]): ChartPoint[] {
  return daily.map((point) => ({
    ...point,
    label: point.date.slice(5),
  }));
}

function formatCost(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(value);
}

function TooltipValue({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between gap-5 leading-none">
      <span className="flex items-center gap-2 text-muted-foreground">
        <span
          className="size-2 rounded-[2px]"
          style={{ backgroundColor: color }}
        />
        {label}
      </span>
      <span className="font-mono font-medium tabular-nums">{value}</span>
    </div>
  );
}

function UsageTooltip({ active, payload }: UsageTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="grid min-w-36 gap-2 rounded-xl bg-popover px-2.5 py-2 text-xs text-popover-foreground shadow-lg ring-1 ring-foreground/5 dark:ring-foreground/10">
      <div className="font-medium">{point.date}</div>
      <div className="grid gap-1.5">
        <TooltipValue
          label="Cost"
          value={formatCost(point.cost)}
          color="var(--color-normal)"
        />
        <TooltipValue
          label="Tokens"
          value={
            point.tokens === null
              ? "Unknown"
              : point.tokens.toLocaleString("en-US")
          }
          color="var(--color-tokens)"
        />
      </div>
      {point.spike && (
        <div className="grid gap-1 border-t pt-1.5">
          <p
            className="font-medium"
            style={{
              color:
                point.spike === "good"
                  ? "var(--color-expected)"
                  : "var(--color-suspicious)",
            }}
          >
            {point.spike === "good" ? "Expected spike" : "Suspicious spike"}
          </p>
          {point.classification?.description && (
            <p className="max-w-56 text-muted-foreground">
              {point.classification.description}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function ResultChart({
  daily,
  isAnimationActive = true,
  compact = false,
}: {
  daily: readonly AnalysisDailyPoint[];
  isAnimationActive?: boolean;
  compact?: boolean;
}) {
  const axisMax = useMemo(() => getAxisMax(daily), [daily]);
  const data = useMemo(() => toChartData(daily), [daily]);
  const tickInterval = Math.max(0, Math.ceil(data.length / 8) - 1);

  const SpikeAwareBar = useCallback(
    (props: BarShapeProps) => {
      const point = data[props.index];
      const fill = BAR_FILL[point?.spike ?? "normal"];
      const isClipped = point !== undefined && point.cost > axisMax;

      return (
        <g>
          <Rectangle {...props} fill={fill} />
          {isClipped && point && (
            <text
              x={props.x + props.width / 2}
              y={props.parentViewBox.y + 13}
              textAnchor="middle"
              fontSize={10}
              fontWeight={600}
              fill={"var(--foreground)"}
              style={{
                paintOrder: "stroke",
                stroke: "var(--background)",
                strokeLinejoin: "round",
                strokeWidth: 3,
                pointerEvents: "none",
              }}
            >
              {formatCost(point.cost)}
            </text>
          )}
        </g>
      );
    },
    [axisMax, data],
  );

  return (
    <div>
      <ChartContainer
        config={chartConfig}
        className={
          compact ? "aspect-auto h-36 min-h-0 w-full" : "min-h-30 w-full"
        }
      >
        <ComposedChart accessibilityLayer data={data}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            interval={tickInterval}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="cost"
            domain={[0, axisMax]}
            allowDataOverflow
            tickLine={false}
            axisLine={false}
            tickFormatter={formatCost}
          />
          <ChartTooltip content={<UsageTooltip />} />
          <Bar
            yAxisId="cost"
            dataKey="cost"
            radius={4}
            shape={SpikeAwareBar}
            isAnimationActive={isAnimationActive}
          />
        </ComposedChart>
      </ChartContainer>
      <div
        className={
          compact
            ? "mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs"
            : "mt-3 flex flex-wrap justify-center gap-x-8 gap-y-2 text-sm"
        }
      >
        {(
          [
            ["zinc-400", "Normal"],
            ["green-500", "Expected spike"],
            ["red-500", "Suspicious spike"],
          ] as const
        ).map(([kind, label]) => (
          <div key={kind} className="flex items-center gap-2">
            <span
              className="size-3 rounded-xs"
              style={{ backgroundColor: "var(--color-" + kind + ")" }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
