# Publiczne demo – wdrożenie (Z29)

Demo: **Vercel** (aplikacja Next.js, darmowy plan Hobby) + **Neon** (PostgreSQL, darmowy plan). Obie usługi mają serwery w UE (Frankfurt). Na demo są wyłącznie dane fikcyjne.

## Jak to działa

- `vercel.json` ustawia build na `node scripts/build-produkcja.mjs`.
- **Wdrożenie produkcyjne** (gałąź `main`): `prisma migrate deploy` → `npm run seed` (konta i dane demo odtworzone od nowa, daty liczone od dnia wdrożenia) → `next build`.
- **Wdrożenia podglądowe** (inne gałęzie): tylko `next build` – nie zmieniają bazy demo.
- Każde wdrożenie `main` przywraca dane demo do stanu początkowego. Wyłączenie: `SEED_ON_DEPLOY=false`.

## Krok po kroku (ok. 15 minut, robi osoba z dostępem do repozytorium)

### 1. Baza danych – Neon
1. Załóż konto na neon.tech i utwórz projekt (region: **AWS Europe Central 1 / Frankfurt**).
2. W „Connection details” wyłącz **Connection pooling** i skopiuj adres połączenia (`postgresql://…?sslmode=require`). To będzie `DATABASE_URL`.

### 2. Aplikacja – Vercel
1. Zaloguj się na vercel.com kontem GitHub.
2. **Add New → Project → Import** repozytorium `MoAI-PL/HACKNATION-26` (repozytorium jest publiczne). Framework: Next.js – ustawienia buildu zostaw domyślne (nadpisuje je `vercel.json`).
3. W **Environment Variables** dodaj (dla środowiska *Production*):

   | Zmienna | Wartość |
   |---|---|
   | `DATABASE_URL` | adres z Neon (krok 1.2) |
   | `AUTH_SECRET` | losowy ciąg – wygeneruj lokalnie: `npx auth secret` |
   | `DEMO_MODE` | `true` |
   | `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | opcjonalnie – darmowy dostawca zgodny z API OpenAI (przykłady w `.env.example`); bez nich asystent działa w trybie bez AI |

4. **Deploy.** W logu buildu powinny być linie `All migrations have been successfully applied` i `Seed: dane demo na dzień …`.

### 3. Sprawdzenie (w oknie prywatnym przeglądarki)
- adres `https://<projekt>.vercel.app` przekierowuje na `/logowanie` z kartami kont demo;
- „Zaloguj jako Ewa Kowalczyk” → pulpit; `/asystent` odpowiada ze źródłami;
- „Zaloguj jako Jan Nowak” → `/moje-oceny`; `/api/asystent/formalny` zwraca 403;
- `/api/v1/status` zwraca `{"status":"ok"}`.

Adres demo wpisz do README i do zgłoszenia w HackTribe.

## Plan awaryjny

Jeśli Vercel albo Neon zawiodą: laptop z `npm run build && npm start` i publiczny tunel (np. Cloudflare Tunnel). Wymaga laptopa włączonego do końca oceny – tylko w ostateczności.
