"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
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
import { isActivePath, type NavIcon, type NavItem } from "@/lib/ui/nav";

const ICONS: Record<NavIcon, LucideIcon> = {
  pulpit: LayoutDashboard,
  pierwsza: UserStar,
  okresowa: CalendarDays,
  dziennik: NotebookPen,
  "asystent-formalny": FileText,
  "asystent-rozmowy": MessagesSquare,
  hr: ShieldCheck,
  moje: UserRoundCheck,
};

/** Menu główne – poziome, zawija się przy 768 px. Aktywna pozycja ma aria-current="page". */
export function MainNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Menu główne" className="border-t bg-card">
      <ul className="mx-auto flex max-w-7xl flex-wrap gap-1 px-4 py-1.5 md:px-6">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActivePath(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.description}
                className={cn(
                  "flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium no-underline transition-colors",
                  active
                    ? "bg-secondary text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
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
