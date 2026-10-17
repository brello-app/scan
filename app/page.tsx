import type { Metadata } from "next";
import { BrelloLogo } from "../components/brand/brello-logo";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { MainDropzone } from "@/components/function/dropzone";
import { LineShadowText } from "@/components/ui/line-shadow-text";
import { CTA } from "@/components/function/cta";
import { WhatBrelloFind } from "@/components/layout/what-brello-find";
import { HowBrelloWorks } from "@/components/layout/how-brello-works";

export const metadata: Metadata = {
  title: "AI Cost Analyzer for OpenAI and Anthropic",
  description:
    "Find unusual AI API spending in your OpenAI or Anthropic CSV export. Analyze usage locally in your browser.",
};

export default function Home() {
  return (
    <main>
      <section className="relative md:py-40 py-20">
        <div className="relative z-10 w-fit mx-auto flex flex-col-reverse md:flex-col">
          <MainDropzone />
          <h1 className="uppercase text-3xl mt-20 md:mt-0 sm:text-5xl md:text-7xl font-black text-center">
            Find where your
            <br />
            AI bill is{" "}
            <LineShadowText className="italic" shadowColor={"white"}>
              leaking
            </LineShadowText>
          </h1>
        </div>
        <div className="absolute left-0 top-0 w-full h-full z-0">
          <FlickeringGrid
            color="rgb(255, 255, 255)"
            squareSize={15}
            flickerChance={0.1}
            maxOpacity={0.05}
          />
        </div>
      </section>
      <WhatBrelloFind />
      <HowBrelloWorks />
      <div className="max-w-300 mx-auto mb-10">
        <CTA />
      </div>
    </main>
  );
}
