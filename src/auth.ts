// Auth.js: logowanie e-mailem i hasłem, sesja JWT w ciasteczku httpOnly.
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";
import { authorizeCredentials } from "@/lib/auth/credentials";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Hasło", type: "password" },
      },
      authorize: (credentials) =>
        authorizeCredentials(credentials, (email) =>
          prisma.user.findUnique({
            where: { email },
            select: { id: true, email: true, name: true, role: true, passwordHash: true },
          }),
        ),
    }),
  ],
  events: {
    async signIn({ user }) {
      if (!user.id) return;
      await prisma.auditLog
        .create({ data: { userId: user.id, action: "LOGOWANIE", entity: "User", entityId: user.id } })
        .catch(() => undefined); // dziennik nie może zablokować logowania
    },
  },
});
