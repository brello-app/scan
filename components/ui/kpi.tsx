import { cn } from "cn";

export function KPICard({
  number,
  unit,
  description,
  className,
  warn = false,
}: {
  number: string;
  unit?: string;
  description: string;
  className?: string;
  warn?: boolean;
}) {
  return (
    <div className={cn(" p-3 text-center", className)}>
      <p>{description}</p>
      <h3
        className={cn("text-5xl font-semibold", warn ? "text-destructive" : "")}
      >
        {number}
        {unit && <span className="text-xl font-semibold">{unit}</span>}
      </h3>
    </div>
  );
}
