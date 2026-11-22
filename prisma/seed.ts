// Dane demo: konta logowania oraz pełne dane wokół persony przełożonej (pracownicy, oceny, obserwacje).
// Seed jest idempotentny – można go uruchamiać wielokrotnie.
import { PrismaClient } from "@prisma/client";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "../src/lib/auth/demo";
import { hashPassword } from "../src/lib/auth/password";
import { seedDemoData } from "../src/lib/demo/dane-demo";

const prisma = new PrismaClient();

async function seedDemoUsers() {
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  for (const a of DEMO_ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: a.email },
      update: { name: a.name, role: a.role, passwordHash },
      create: { email: a.email, name: a.name, role: a.role, passwordHash },
    });
  }
  console.log(`Seed: ${DEMO_ACCOUNTS.length} konta demo (hasło: ${DEMO_PASSWORD}).`);
}

async function main() {
  await seedDemoUsers();
  const demo = await seedDemoData(prisma);
  console.log(`Seed: dane demo na dzień ${demo.today} – ${demo.employees} pracowników, ${demo.evaluations} ocen, ${demo.observations} obserwacji.`);
  await prisma.appInfo.upsert({
    where: { key: "seed" },
    update: { value: new Date().toISOString() },
    create: { key: "seed", value: new Date().toISOString() },
  });
  console.log("Seed: dane startowe zapisane.");
}

main()
  .catch((e) => {
    console.error("Seed nie powiódł się:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
