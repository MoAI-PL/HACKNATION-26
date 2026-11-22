"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FileSignature,
  FileText,
  LayoutDashboard,
  MessagesSquare,
  NotebookPen,
  ShieldCheck,
  UserRoundCheck,
  UserStar,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { activeHref, type NavIcon, type NavItem } from "@/lib/ui/nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  pulpit: LayoutDashboard,
  pierwsza: UserStar,
  okresowa: CalendarDays,
  dziennik: NotebookPen,
  "asystent-formalny": FileText,
  "asystent-rozmowy": MessagesSquare,
  hr: ShieldCheck,
  moje: UserRoundCheck,
  podpis: FileSignature,
};

/**
 * Menu główne – poziome; na wąskim ekranie przewija się w bok (jeden wiersz zamiast kilku).
 * Aktywna pozycja: granatowy tekst i podkreślenie (aria-current="page" – nie sam kolor).
 */
export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const current = activeHref(pathname, items);
  return (
    <nav aria-label="Menu główne" className="border-t bg-card">
      <ul className="relative mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 [scrollbar-width:thin] md:px-6">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.href === current;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.description}
                className={cn(
                  "relative flex min-h-11 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap no-underline transition-colors",
                  "after:absolute after:inset-x-2 after:bottom-0 after:h-[3px] after:rounded-t-sm",
                  active
                    ? "text-primary after:bg-primary"
                    : "text-muted-foreground hover:text-foreground hover:after:bg-border",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
