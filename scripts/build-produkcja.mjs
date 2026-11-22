// Build publicznego demo – uruchamiany przez Vercel (vercel.json → buildCommand).
//
// Tylko wdrożenie produkcyjne (VERCEL_ENV=production) dotyka bazy:
//   1. prisma migrate deploy – migracje,
//   2. npm run seed          – konta i dane demo odtworzone od nowa, daty liczone od dnia wdrożenia.
// Wdrożenia podglądowe (gałęzie) budują tylko aplikację – nie mogą zmienić bazy demo.
// Lokalnie: VERCEL_ENV=production node scripts/build-produkcja.mjs (z DATABASE_URL w .env).

import { execSync } from "node:child_process";

const run = (cmd, env = process.env) => {
  console.log(`\n▶ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env });
};

const production = process.env.VERCEL_ENV === "production";

if (production) {
  if (!process.env.DATABASE_URL) {
    console.error("Brak DATABASE_URL – podłącz bazę: Vercel → projekt → Storage → Neon (docs/WDROZENIE.md), potem Redeploy.");
    process.exit(1);
  }
  if (!process.env.AUTH_SECRET) {
    console.error("Brak AUTH_SECRET – dodaj zmienną: Vercel → projekt → Settings → Environment Variables (docs/WDROZENIE.md), potem Redeploy.");
    process.exit(1);
  }
  // Integracja Neon w Vercelu ustawia DATABASE_URL (pula połączeń) i DATABASE_URL_UNPOOLED (bezpośrednie).
  // Migracje i seed idą połączeniem bezpośrednim, aplikacja korzysta z puli.
  const dbEnv = { ...process.env, DATABASE_URL: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL };
  run("npx prisma migrate deploy", dbEnv);
  if (process.env.SEED_ON_DEPLOY !== "false") run("npm run seed", dbEnv);
} else {
  console.log(`VERCEL_ENV=${process.env.VERCEL_ENV ?? "(brak)"} – pomijam migracje i seed (baza demo bez zmian).`);
}

run("npx next build");
