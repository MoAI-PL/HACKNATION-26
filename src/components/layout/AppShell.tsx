import * as React from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import type { Role } from "@/lib/domain/types";
import { ROLE_LABELS } from "@/lib/domain/slownik";
import { navForRole, roleHasQuickNote } from "@/lib/ui/nav";
import { MainNav } from "./MainNav";
import { HeaderActions } from "./HeaderActions";
import { GlobalShortcuts } from "./Shortcuts";

// Układ aplikacji po zalogowaniu (Z10): link „Przejdź do treści”, nagłówek z nazwą, rolą i akcjami,
// menu według grafiki MC, treść z jednym <main>.
//
// Użycie w layoutach grup tras (Z04 dostarcza użytkownika z sesji):
//   const user = await getCurrentUser();
//   return <AppShell user={{ name: user.name, role: user.role }} userMenu={<WylogujButton />}>{children}</AppShell>;

export interface ShellUser {
  name: string;
  role: Role;
}

export function AppShell({
  user,
  userMenu,
  children,
}: {
  user: ShellUser;
  /** Miejsce na przycisk wylogowania / menu konta (Z04). */
  userMenu?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#tresc"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Przejdź do treści
      </a>

      <header className="sticky top-0 z-30 bg-card shadow-xs">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-foreground no-underline">
            <Compass className="size-7 text-primary" aria-hidden />
            <span className="text-lg font-semibold tracking-tight">Kompas Kompetencji</span>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <HeaderActions quickNote={roleHasQuickNote(user.role)} />
            <div className="flex items-center gap-2 border-l pl-3">
              <div className="flex flex-col text-right leading-tight">
                <span className="text-sm font-medium">{user.name}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
              </div>
              {userMenu}
            </div>
          </div>
        </div>
        <MainNav items={navForRole(user.role)} />
      </header>

      <main id="tresc" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 md:px-6 md:py-8">
        {children}
      </main>

      <GlobalShortcuts />
    </div>
  );
}

/** Nagłówek ekranu: jeden tytuł (h1), opis i miejsce na jedną główną akcję (sekcja 4.1 pkt 2). */
export function PageHeader({
  title,
  description,
  action,
  badge,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl">{title}</h1>
          {badge}
        </div>
        {description && <p className="max-w-3xl text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
