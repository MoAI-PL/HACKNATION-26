// Rozszerzenie typów Auth.js o id i rolę użytkownika.
import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/domain/types";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role } & DefaultSession["user"];
  }
  interface User {
    role: Role;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: Role;
  }
}
