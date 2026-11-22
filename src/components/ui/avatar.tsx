import { cn } from "@/lib/utils";

// Inicjały osoby w kółku – szybkie rozpoznanie na listach. Kolor stały dla osoby (z imienia i nazwiska),
// z palety stonowanych par tło/tekst o kontraście ≥ 4,5:1. Kolor niczego nie znaczy – to tylko rozróżnienie.

const PALETTE = [
  "bg-[#e8eef7] text-[#1f3f6e]",
  "bg-[#e9f3ee] text-[#1d5235]",
  "bg-[#f6eee4] text-[#6b3f0f]",
  "bg-[#f1ebf6] text-[#55327a]",
  "bg-[#e7f2f4] text-[#14505c]",
  "bg-[#f5e9ec] text-[#7a2638]",
] as const;

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]![0] : "";
  return `${first}${last}`.toLocaleUpperCase("pl");
}

export function avatarTone(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

/** Awatar z inicjałami. Dekoracyjny (aria-hidden) – imię i nazwisko jest zawsze obok w tekście. */
export function Avatar({ name, size = "md", className }: { name: string; size?: "sm" | "md" | "lg"; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-12 text-base" : "size-10 text-sm",
        avatarTone(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
