"use client";
import { BrelloLogo } from "../brand/brello-logo";

export function GlobalFooter() {
  return (
    <footer>
      <BrelloLogo className="w-full fill-foreground/5" />
      <p className="text-center mt-15 text-lg text-foreground/50 mb-20">
        Copyright © 2026 Brello.
      </p>
    </footer>
  );
}
