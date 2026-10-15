"use client";
import Link from "next/link";
import { BrelloScanLogo } from "../brand/brello-scan-logo";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { buttonVariants } from "../ui/button";

export function GlobalHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <header
      className={cn(
        "w-screen fixed top-0 z-50 transition-[background-color] duration-300",
        scrolled ? "bg-background" : "",
      )}
    >
      <div className="max-w-300 py-5 w-full mx-auto flex justify-between items-center">
        <Link href={"/"}>
          <BrelloScanLogo className="w-30" />
        </Link>
        <div>
          <Link className={buttonVariants()} href={"/"}>
            Get Early Access
          </Link>
        </div>
      </div>
    </header>
  );
}
