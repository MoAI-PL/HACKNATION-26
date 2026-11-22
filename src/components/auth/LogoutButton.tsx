// Przycisk wylogowania w nagłówku AppShell (akcja wylogowania i miejsce w układzie).
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logoutAction } from "@/lib/auth/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost">
        <LogOut aria-hidden />
        Wyloguj
      </Button>
    </form>
  );
}
