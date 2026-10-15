import { AlertBanner } from "@/components/ui/alert-banner";
import { KPICard } from "@/components/ui/kpi";

export default function ResultPage() {
  return (
    <main className="my-20 max-w-300 w-full mx-auto">
      <AlertBanner
        title="An unfamiliar API key spent $1,539 in 2 days"
        contents="key_2Lvd…XGY5 · Oct 8–9 · gpt-5.5 · That’s 66% of your total bill.
[Revoke this key in OpenAI →] [Is this you? Mark as expected]"
      />
      <div className="flex py-5">
        <KPICard className="flex-1" number="$2346" description="Total spent" />
        <KPICard
          className="flex-1"
          number="$1539"
          description="Suspicious spend"
          warn
        />
        <KPICard
          className="flex-1"
          number="$808"
          unit="/mo"
          description="Normal run-rate"
        />
        <KPICard
          className="flex-1"
          number="$303"
          unit="/mo"
          description="You could save."
        />
      </div>
    </main>
  );
}
