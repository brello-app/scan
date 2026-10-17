import { CTAForm } from "./cta-form";

export function CTA() {
  return (
    <div className="w-full border border-foreground p-2 mt-20 z-40 relative">
      <div className="w-full p-10 bg-primary text-primary-foreground flex justify-between">
        <div className="flex-1 flex flex-col justify-between">
          <h1 className="text-4xl font-black">
            This report looks back.
            <br />
            Brello can watch it <span className="italic">live</span>.
          </h1>
          <p className="text-2xl mt-10">
            Catch leaked keys the moment they’re used,
            <br />
            not after the bill arrives.
          </p>
        </div>
        <div className="w-px h-full my-auto bg-primary-foreground"></div>
        <div className="flex-1">
          <CTAForm />
        </div>
      </div>
    </div>
  );
}
