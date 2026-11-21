// Przycisk wylogowania w nagłówku AppShell (Z04 – akcja, Z10 – miejsce w układzie).
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
