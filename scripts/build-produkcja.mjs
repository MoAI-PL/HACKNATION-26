// Build publicznego demo (Z29) – uruchamiany przez Vercel (vercel.json → buildCommand).
//
// Tylko wdrożenie produkcyjne (VERCEL_ENV=production) dotyka bazy:
//   1. prisma migrate deploy – migracje,
//   2. npm run seed          – konta i dane demo odtworzone od nowa, daty liczone od dnia wdrożenia.
// Wdrożenia podglądowe (gałęzie) budują tylko aplikację – nie mogą zmienić bazy demo.
// Lokalnie: VERCEL_ENV=production node scripts/build-produkcja.mjs (z DATABASE_URL w .env).

import { execSync } from "node:child_process";

const run = (cmd) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit" });
};

const production = process.env.VERCEL_ENV === "production";

if (production) {
  if (!process.env.DATABASE_URL) {
    console.error("Brak DATABASE_URL – ustaw zmienną w ustawieniach projektu (Environment Variables).");
    process.exit(1);
  }
  if (!process.env.AUTH_SECRET) {
    console.error("Brak AUTH_SECRET – ustaw zmienną w ustawieniach projektu (Environment Variables).");
    process.exit(1);
  }
  run("npx prisma migrate deploy");
  if (process.env.SEED_ON_DEPLOY !== "false") run("npm run seed");
} else {
  console.log(`VERCEL_ENV=${process.env.VERCEL_ENV ?? "(brak)"} – pomijam migracje i seed (baza demo bez zmian).`);
}

run("npx next build");
