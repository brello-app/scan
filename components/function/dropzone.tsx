"use client";

import { useEffect, useRef, useState } from "react";
import { Telescope } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "cn";
import { parseCsvFile, parseCsvUrl } from "@/lib/parse-csv";
import { useRouter } from "next/navigation";
import { saveUsage } from "@/lib/usage-storage";

export function MainDropzone() {
  const [isDragActive, setIsDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.currentTarget === e.target) {
      setIsDragActive(false);
    }
  };

  useEffect(() => {
    if (files.length == 0) return;
    const prepare = async () => {
      const file = files[0];
      const res = await parseCsvFile(file);
      setFiles([]);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (!saveUsage(res.rows, "upload", file.name))
        return alert("File is too large to analyze in the browser.");
      router.push("/result");
    };
    prepare();
  }, [files, router]);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const file = Array.from(e.dataTransfer.files).find((file) =>
      file.name.toLowerCase().endsWith(".csv"),
    );

    if (file) {
      setFiles([file]);
    }
  };

  return (
    <>
      <input
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        ref={fileRef}
        onChange={(e) => {
          const file = e.target.files?.[0];

          if (file) {
            setFiles([file]);
          }
          e.target.value = "";
        }}
      />
      <div
        id="scanner"
        role="region"
        aria-label="CSV scanner"
        tabIndex={-1}
        className={cn(
          "relative mx-auto h-70 w-full scroll-mt-24 text-primary/50 transition-colors duration-200 my-10 cursor-pointer",
          isDragActive
            ? "bg-[linear-gradient(to_right,currentColor_60%,transparent_60%),linear-gradient(to_bottom,currentColor_60%,transparent_60%),linear-gradient(to_right,currentColor_60%,transparent_60%),linear-gradient(to_bottom,currentColor_60%,transparent_60%)]"
            : "",
          isDragActive ? "bg-size-[20px_2px,2px_20px,20px_2px,2px_20px]" : "",
          isDragActive
            ? "bg-position-[top_left,top_right,bottom_right,bottom_left]"
            : "",
          isDragActive
            ? "[background-repeat:repeat-x,repeat-y,repeat-x,repeat-y]"
            : "",
          isDragActive ? "bg-primary/10" : "",
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => {
          if (fileRef.current) fileRef.current.click();
        }}
      >
        {/** Corner Crosses */}
        <div className="absolute top-0 left-0 pointer-events-none">
          <div className="absolute top-0 -left-3.75 w-7.5 h-0.5 bg-(--color-foreground)" />
          <div className="absolute -top-3.75 left-0 w-0.5 h-7.5 bg-(--color-foreground)" />
        </div>
        <div className="absolute top-0 right-0 pointer-events-none">
          <div className="absolute top-0 -right-3.75 w-7.5 h-0.5 bg-(--color-foreground)" />
          <div className="absolute -top-3.75 right-0 w-0.5 h-7.5 bg-(--color-foreground)" />
        </div>
        <div className="absolute bottom-0 left-0 pointer-events-none">
          <div className="absolute bottom-0 -left-3.75 w-7.5 h-0.5 bg-(--color-foreground)" />
          <div className="absolute -bottom-3.75 left-0 w-0.5 h-7.5 bg-(--color-foreground)" />
        </div>
        <div className="absolute bottom-0 right-0 pointer-events-none">
          <div className="absolute bottom-0 -right-3.75 w-7.5 h-0.5 bg-(--color-foreground)" />
          <div className="absolute -bottom-3.75 right-0 w-0.5 h-7.5 bg-(--color-foreground)" />
        </div>

        {/** Inner Contents */}
        <div className="p-5 w-fit mx-auto h-full flex flex-col justify-center items-center text-foreground">
          <Telescope className="size-20" strokeWidth={1} />
          <h3 className="text-xl">Drop Your .csv File Here</h3>
          <p className="text-sm text-foreground/50 text-center mt-2">
            Your file never leaves your browser. <br /> We only collect
            anonymous clicks <br />
            to improve the site.
          </p>
          <div className="flex text-sm my-3 w-full gap-5 items-center">
            <div className="flex-1 h-px bg-foreground/30"></div>
            <p>OR</p>
            <div className="flex-1 h-px bg-foreground/30"></div>
          </div>
          <Button
            variant={"outline"}
            className={"cursor-pointer"}
            onClick={(e) => {
              const prepare = async () => {
                const res = await parseCsvUrl("/sample/openai_usage.csv");
                if (res.ok) {
                  saveUsage(res.rows, "sample", "openai_usage.csv");
                  router.push("/result");
                }
              };
              prepare();
              e.stopPropagation();
            }}
          >
            Try With Sample Data
          </Button>
        </div>
        {error !== "" && (
          <p className="text-xs text-destructive mt-2 text-center">{error}</p>
        )}
      </div>
    </>
  );
}

