import Image from "next/image";
import { BrelloLogo } from "../components/brand/brello-logo";
import { FlickeringGrid } from "@/components/ui/flickering-grid";
import { MainDropzone } from "@/components/function/dropzone";
import { LineShadowText } from "@/components/ui/line-shadow-text";

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
    </main>
  );
}
