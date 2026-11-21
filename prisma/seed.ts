// Dane demo – pełną wersję przygotowuje Z26.
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
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
