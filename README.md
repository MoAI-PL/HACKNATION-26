# Kompas Kompetencji

**Ocena oparta na zachowaniach, nie na wrażeniach.**

Aplikacja prowadzi przełożonego w służbie cywilnej krok po kroku przez pierwszą ocenę i ocenę okresową (arkusze B i C): od analizy opisu stanowiska, przez wybór kryteriów i dziennik obserwacji, po ocenę opartą na 49 wskaźnikach behawioralnych modelu kompetencji. System proponuje poziom kompetencji i wyjaśnia, skąd się wziął, ale decyzję zawsze podejmuje przełożony. Wynik, terminy i formularz PDF liczone są zgodnie z rozporządzeniami.

Projekt powstaje podczas HackNation 2026 w ramach zadania Ministerstwa Cyfryzacji (Biuro Dyrektora Generalnego) „Kompas Kompetencji”.

## Stan

Prace w toku – postęp na tablicy zadań: [`docs/ZADANIA.md`](docs/ZADANIA.md).

## Struktura repozytorium

```
materialy/          materiały źródłowe od organizatora (tylko do odczytu)
  zadanie/          treść i regulamin zadania
  ocena-okresowa/   arkusze B i C, poradnik, rozporządzenie z 2016 r.
  pierwsza-ocena/   arkusz, poradnik, rozporządzenie z 2015 r.
  OSP/              przykładowe opisy stanowisk pracy
docs/               tablica zadań, założenia, dokumentacja
```

## Uruchomienie lokalne

Wymagania: Node.js 20+, Docker.

1. `npm install`
2. `cp .env.example .env` (na Windows: `copy .env.example .env`) i uzupełnij `AUTH_SECRET`
3. `npm run db:up` – uruchamia PostgreSQL w Dockerze
4. `npm run db:migrate` i `npm run seed`
5. `npm run dev` – aplikacja pod http://localhost:3000

## Skrypty

| Polecenie | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm test` | testy (Vitest) |
| `npm run typecheck` / `npm run lint` | kontrola typów / lint |
| `npm run build` | build produkcyjny |
| `npm run seed` | dane demo |
| `npm run wiedza` | buduje bazę wiedzy asystenta z PDF-ów (`data/wiedza/fragmenty.json`) |
| `npm run eval` | zestaw testowy asystenta formalnego |
| `npm run model` | import modelu kompetencji: `materialy/Model_kompetencji.xlsx` → `data/model-kompetencji.json` (`-- --check` sprawdza aktualność) |
| `npm run db:up` / `db:migrate` / `db:generate` | baza danych: start, migracje, klient Prisma |

## Materiały źródłowe

Pliki w `materialy/` pochodzą od organizatora zadania (Ministerstwo Cyfryzacji) i zostały udostępnione na potrzeby hackathonu.
