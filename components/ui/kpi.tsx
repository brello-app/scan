import { cn } from "cn";

export function KPICard({
  number,
  unit,
  description,
  caption,
  className,
  warn = false,
}: {
  number: string;
  unit?: string;
  description: string;
  caption?: string;
  className?: string;
  warn?: boolean;
}) {
  const splitedCaption = caption?.split("\n");
  return (
    <div className={cn(" p-3 text-center", className)}>
      <p>{description}</p>
      <h3
        className={cn(
          "text-5xl font-semibold py-3",
          warn ? "text-destructive" : "",
        )}
      >
        {number}
        {unit && <span className="text-xl font-semibold">{unit}</span>}
      </h3>
      {caption && splitedCaption && (
        <div className="mt-1 text-xs text-muted-foreground">
          {splitedCaption.map((item) => (
            <p key={item}>{item}</p>
          ))}
        </div>
      )}
    </div>
  );
}
