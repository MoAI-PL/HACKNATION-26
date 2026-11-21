import { UserBar } from "@/components/auth/UserBar";
import { requirePageRole } from "@/lib/auth/guard";

// Każdy ekran w tej grupie wymaga roli KIERUJACY_KOMORKA – sprawdzane na serwerze, niezależnie od middleware.
export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await requirePageRole("KIERUJACY_KOMORKA");
  return (
    <>
      <UserBar user={user} />
      {children}
    </>
  );
}
