"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button type="button" className="h-10 print:hidden" onClick={() => window.print()}>
      <Printer aria-hidden /> Drukuj
    </Button>
  );
}
