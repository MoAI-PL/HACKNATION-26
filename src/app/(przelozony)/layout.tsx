import { AppShell, shellUser } from "@/components/layout/AppShell";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { requirePageRole } from "@/lib/auth/guard";

// Każdy ekran w tej grupie wymaga roli PRZELOZONY – sprawdzane na serwerze, niezależnie od middleware.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("PRZELOZONY");
  return (
    <AppShell user={shellUser(user)} userMenu={<LogoutButton />}>
      {children}
    </AppShell>
  );
}
