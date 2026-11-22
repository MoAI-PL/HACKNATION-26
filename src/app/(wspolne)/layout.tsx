import { AppShell, shellUser } from "@/components/layout/AppShell";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { requirePageRole } from "@/lib/auth/guard";

// Ekrany wspólne dla kilku ról (np. asystent formalny): przełożony, HR i kierujący komórką,
// tak jak obszar „/asystent” w src/lib/auth/role.ts. Sprawdzane na serwerze, niezależnie od middleware.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("PRZELOZONY", "HR", "KIERUJACY_KOMORKA");
  return (
    <AppShell user={shellUser(user)} userMenu={<LogoutButton />}>
      {children}
    </AppShell>
  );
}
