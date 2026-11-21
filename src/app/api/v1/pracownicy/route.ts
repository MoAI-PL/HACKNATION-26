import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRole } from "@/lib/auth/guard";

// Lista pracowników (pod EZD / system kadrowy, rozwija Z38).
// HR widzi wszystkich, przełożony tylko swoich podwładnych. Pozostałe role: 403.
export const GET = withRole(["HR", "PRZELOZONY"], async (_req, _ctx, user) => {
  const employees = await prisma.employee.findMany({
    where: user.role === "HR" ? {} : { supervisorId: user.id },
    select: { id: true, firstName: true, lastName: true, orgUnit: { select: { name: true } }, position: { select: { title: true } } },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return NextResponse.json({ data: employees });
});
