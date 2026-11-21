// Pasek zalogowanego użytkownika (Z04). Docelowy nagłówek aplikacji buduje Z10 – może przenieść ten komponent.
import { Compass, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";
import { ROLE_LABELS } from "@/lib/domain/slownik";
import type { SessionUser } from "@/lib/auth/access";

export function UserBar({ user }: { user: SessionUser }) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <div className="flex items-center gap-2 text-primary">
          <Compass className="size-6" aria-hidden />
          <span className="font-semibold">Kompas Kompetencji</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end leading-tight">
            <span className="text-sm font-medium">{user.name}</span>
            <span className="text-xs text-muted-foreground">{ROLE_LABELS[user.role]}</span>
          </div>
          <form action={logoutAction}>
            <Button type="submit" variant="ghost" className="h-9">
              <LogOut aria-hidden />
              Wyloguj
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
