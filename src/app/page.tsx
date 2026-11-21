import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ROLE_HOME } from "@/lib/auth/role";

// Strona główna kieruje od razu na ekran roli albo na logowanie (middleware robi to samo, to zabezpieczenie zapasowe).
export default async function Home() {
  const session = await auth();
  redirect(session?.user?.role ? ROLE_HOME[session.user.role] : "/logowanie");
}
