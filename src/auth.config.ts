// Konfiguracja Auth.js bez bazy danych i bcrypt – bezpieczna dla middleware (edge).
// Pełna konfiguracja z dostawcą logowania jest w src/auth.ts.
import type { NextAuthConfig } from "next-auth";
import { canAccessPath, isOpenPath, isPublicPath, isRole, ROLE_HOME } from "@/lib/auth/role";

/** Czas życia sesji: 8 godzin (jeden dzień pracy). */
const SESSION_MAX_AGE = 8 * 60 * 60;

export const authConfig = {
  pages: { signIn: "/logowanie" },
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  // Demo za tunelem / na Vercelu – adres hosta bierzemy z żądania.
  trustHost: true,
  providers: [],
  callbacks: {
    /** Middleware: decyzja dla ekranów. API sprawdza uprawnienia samo (withRole), żeby zwracać 401/403 zamiast przekierowań. */
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const role = auth?.user?.role;

      if (isOpenPath(pathname)) return true;
      if (isPublicPath(pathname)) {
        // Zalogowany na ekranie logowania → od razu do swojego ekranu.
        if (role) return Response.redirect(new URL(ROLE_HOME[role], request.nextUrl));
        return true;
      }
      if (!role) return false; // Auth.js przekieruje na /logowanie z callbackUrl
      if (pathname === "/") return Response.redirect(new URL(ROLE_HOME[role], request.nextUrl));
      if (!canAccessPath(role, pathname)) {
        return Response.redirect(new URL(ROLE_HOME[role], request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        if (typeof token.id === "string") session.user.id = token.id;
        if (isRole(token.role)) session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
