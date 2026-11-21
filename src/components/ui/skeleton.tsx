import { cn } from "@/lib/utils";

/** Szkielet treści na czas ładowania (dekoracyjny – tekst stanu podaje komponent nadrzędny). */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} />;
}
