import { NextResponse } from "next/server";
import { withRole } from "@/lib/auth/guard";

// Bieżący użytkownik. Dowolna rola, ale wymaga zalogowania (bez sesji: 401).
export const GET = withRole([], (_req, _ctx, user) =>
  NextResponse.json({ id: user.id, name: user.name, email: user.email, role: user.role }),
);
