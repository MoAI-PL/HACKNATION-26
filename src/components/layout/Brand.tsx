import Link from "next/link";
import { Compass } from "lucide-react";
import { cn } from "@/lib/utils";

// Znak aplikacji: kompas w granatowym kwadracie i nazwa. Bez logotypów MC i gov.pl (docs/UX.md, zasada 10).

export function BrandMark({ size = "md", className }: { size?: "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
        size === "lg" ? "size-12" : "size-9",
        className,
      )}
    >
      <Compass className={size === "lg" ? "size-7" : "size-5"} strokeWidth={2.25} />
    </span>
  );
}

/** Znak z nazwą i podpisem – link do strony startowej roli. */
export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-3 text-foreground no-underline", className)}>
      <BrandMark />
      <span className="flex flex-col leading-tight">
        <span className="text-base font-semibold tracking-tight">Kompas Kompetencji</span>
        <span className="text-xs text-muted-foreground">Oceny w służbie cywilnej</span>
      </span>
    </Link>
  );
}

/** Pasek informacyjny nad nagłówkiem – urzędowy, spokojny; w wersji demonstracyjnej mówi o danych fikcyjnych. */
export function ServiceBar({ demo }: { demo: boolean }) {
  return (
    <div className="bg-[#173d70] text-white print:hidden">
      <p className="mx-auto max-w-7xl px-4 py-1.5 text-xs md:px-6">
        Wsparcie przełożonych w pierwszej ocenie i ocenie okresowej członków korpusu służby cywilnej
        {demo && <span className="font-semibold"> · wersja demonstracyjna, dane fikcyjne</span>}
      </p>
    </div>
  );
}
