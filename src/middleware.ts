// Middleware (Z04): przekierowanie niezalogowanych na /logowanie i pilnowanie obszarów ról.
// To pierwsza linia obrony. Każdy ekran i handler API i tak sprawdza rolę po stronie serwera (src/lib/auth/guard.ts).
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  // Pomijamy API (samo zwraca 401/403), pliki Next.js i statyczne.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|txt)$).*)"],
};
