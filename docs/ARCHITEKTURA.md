# Architektura

Kompas Kompetencji to jedna aplikacja webowa (Next.js) z interfejsem i API, bazą PostgreSQL i wymiennym modelem językowym. Logika przepisów jest oddzielona od interfejsu i od AI: to czyste funkcje TypeScript z testami, sterowane parametrami z `data/przepisy.json`.

## Przegląd

```mermaid
flowchart LR
  subgraph P[Przeglądarka]
    UI["Ekrany ról<br/>przełożony · HR · oceniany · kierujący"]
  end
  subgraph A[Aplikacja Next.js]
    MW["Middleware<br/>sesja i obszary ról"]
    SC["Ekrany i akcje serwerowe<br/>autoryzacja w każdej akcji"]
    API["REST API<br/>/api/v1, /api/asystent"]
    RULES["Silnik reguł<br/>punktacja §11/§10 · terminy KC · arkusz · sugestia"]
    IMP["Import<br/>OSP .docx · model kompetencji .xlsx"]
    AI["Warstwa AI<br/>asystent formalny · kryteria z OSP"]
    RAG["Baza wiedzy<br/>406 fragmentów, BM25"]
  end
  DB[("PostgreSQL<br/>Prisma")]
  LLM["Model językowy<br/>API zgodne z OpenAI<br/>Ollama lokalnie / Gemini na demo"]
  CFG["data/przepisy.json<br/>data/model-kompetencji.json"]

  UI --> MW --> SC
  UI --> API
  SC --> RULES
  SC --> IMP
  SC --> DB
  API --> AI
  API --> DB
  AI --> RAG
  AI -.opcjonalnie.-> LLM
  RULES --> CFG
  IMP --> CFG
```

- **Ekrany i akcje serwerowe** (App Router) dla czterech ról. Middleware kieruje niezalogowanych na logowanie, a każda akcja i każdy handler API sprawdza rolę i zakres danych sam.
- **Silnik reguł** (`src/lib/rules/`) liczy arkusz, punkty, poziom ogólny, wynik, sugerowany poziom i wszystkie terminy. Nie korzysta z AI.
- **Warstwa AI** (`src/lib/ai/`) ma jeden interfejs dostawcy zgodny z API OpenAI. Gdy modelu nie ma albo zawiedzie, funkcje AI przechodzą w tryb bez AI (źródła albo propozycja deterministyczna). Szczegóły: [`AI.md`](AI.md).
- **Baza danych** przechowuje pracowników, stanowiska (OSP), oceny, oceny wskaźników, obserwacje, rozmowy, nieobecności, przypomnienia, dziennik decyzji i dziennik zapytań asystenta.

## Model danych

```mermaid
erDiagram
  User ||--o{ Employee : "przełożony (supervisor)"
  User ||--o{ Employee : "kierujący komórką"
  User |o--o| Employee : "konto ocenianego"
  OrgUnit ||--o{ OrgUnit : "struktura"
  OrgUnit ||--o{ Employee : ""
  OrgUnit ||--o{ Position : ""
  Position ||--o{ Employee : "OSP"
  Employee ||--o{ Evaluation : ""
  User ||--o{ Evaluation : "oceniający"
  Evaluation ||--o{ EvaluationCriterion : "kryteria"
  EvaluationCriterion ||--o{ IndicatorRating : "oceny wskaźników"
  Evaluation |o--o| FirstEvalReport : "sprawozdanie"
  Evaluation ||--o{ Conversation : "rozmowy"
  Employee ||--o{ Observation : "dziennik SDR"
  Employee ||--o{ Absence : "nieobecności"
  Employee ||--o{ PositionChange : "zmiany stanowiska"
  User ||--o{ Reminder : "przypomnienia"
  User ||--o{ AuditLog : "dziennik decyzji"
  User ||--o{ AssistantQuery : "dziennik zapytań"
```

| Model | Rola |
|---|---|
| `User` | konto z rolą (`PRZELOZONY`, `HR`, `OCENIANY`, `KIERUJACY_KOMORKA`), hasło jako skrót bcrypt |
| `OrgUnit`, `Position`, `Employee` | struktura urzędu, opis stanowiska pracy (pola z OSP + pełny tekst), kartoteka pracownika z przełożonym i kierującym komórką |
| `Evaluation` | ocena okresowa albo pierwsza: arkusz, etap, okres, termin, wynik, poziom ogólny, średnia, uzasadnienie, IPRZ, dane poprzedniej oceny, część III, stan kreatora (autozapis) |
| `EvaluationCriterion`, `IndicatorRating` | kryterium (obowiązkowe/dodatkowe, z uzasadnieniem wyboru), ocena cząstkowa przełożonego, sugestia systemu i powód zmiany; wybór opisu zachowania przy wskaźniku (1–5 albo „brak okazji do obserwacji”) |
| `Observation` | dziennik obserwacji: data, wskaźnik, Sytuacja – Działanie – Rezultat, źródło (ręczna / szybka notatka) |
| `Conversation`, `FirstEvalReport` | rozmowy (wstępna, rozpoczynająca, oceniająca, bieżąca) i sprawozdanie do pierwszej oceny |
| `Absence`, `PositionChange`, `Reminder` | wejście silnika terminów i przypomnienia |
| `AuditLog`, `AssistantQuery` | dziennik decyzji (propozycja AI obok decyzji człowieka, zmiany sugestii, arkusza, przepisów) i dziennik zapytań asystenta |

Typy domeny i wartości wyliczeniowe są w `src/lib/domain/types.ts`; test pilnuje ich zgodności ze schematem Prisma.

## API

Pełna specyfikacja: [`openapi.yaml`](openapi.yaml). Każdy endpoint (poza statusem) wymaga sesji; bez sesji – 401, przy złej roli – 403, z komunikatem po polsku.

| Metoda i ścieżka | Role | Opis |
|---|---|---|
| `GET /api/v1/status` | publiczny | kontrola działania (monitoring wdrożenia) |
| `GET /api/v1/me` | zalogowany | dane zalogowanego użytkownika i rola |
| `GET /api/v1/pracownicy` | przełożony, HR | lista pracowników; przełożony – tylko własni podwładni |
| `GET /api/v1/oceny` | HR, przełożony, oceniany | lista ocen z filtrami (`status`, `typ`, `pracownikId`); HR – wszystkie, przełożony – podwładnych, oceniany – własne sporządzone |
| `GET /api/v1/oceny/{id}` | HR, przełożony, oceniany | **eksport oceny w JSON** pod EZD i system kadrowy; ocena spoza zakresu = 404 |
| `GET /api/asystent/formalny?krok=…` | przełożony, HR, kierujący | podpowiedzi pytań dla kroku ścieżki, dostępność modelu |
| `POST /api/asystent/formalny` | przełożony, HR, kierujący | pytanie → odpowiedź ze źródłami albo odmowa |
| `POST /api/asystent/kryteria` | przełożony, HR | propozycja kryteriów dodatkowych z OSP (plik albo pracownik z bazy) |

Ekrany zapisują dane akcjami serwerowymi Next.js (z walidacją zod i autoryzacją w każdej akcji). Integracja z EZD i systemem kadrowym (np. QNT): eksport oceny w JSON działa (`/api/v1/oceny/{id}`); import pracowników i OSP z systemu kadrowego oraz arkusz w PDF przez API są opisane w specyfikacji jako planowane.

## Wdrożenie i skalowanie

| Środowisko | Jak |
|---|---|
| **Lokalnie** | `docker compose up` (PostgreSQL 16) + `npm run dev`; model opcjonalny (Ollama) |
| **Demo** | Vercel (aplikacja, region Frankfurt) + Neon (PostgreSQL, Frankfurt) + Gemini (darmowy plan) – [`WDROZENIE.md`](WDROZENIE.md). Każde wdrożenie gałęzi `main` stosuje migracje i odtwarza dane demo |
| **Docelowo w urzędzie** | kontener Node.js (`npm run build && npm start`) za reverse proxy z TLS, PostgreSQL urzędu, model lokalny przez Ollamę na serwerze z GPU (np. Bielik) – dane nie opuszczają infrastruktury urzędu |

Skalowanie:
- **Aplikacja jest bezstanowa** (sesja JWT w ciasteczku), więc skaluje się poziomo – kolejne instancje za load balancerem. Jedyny stan w pamięci to limit zapytań do AI; przy wielu instancjach trzeba go przenieść do Redis.
- **Baza:** obciążenie jest małe (kilkadziesiąt ocen na przełożonego co 2 lata); indeksy na przełożonym, ocenianym i etapie oceny. Pula połączeń (np. PgBouncer / pooler Neon).
- **Model:** jedyny element kosztowny obliczeniowo. Wyszukiwanie BM25 działa w procesie aplikacji (406 fragmentów, milisekundy); do modelu trafia tylko 5 fragmentów i pytanie. Odmowa poza zakresem nie woła modelu.
- **Wiele urzędów:** parametry przepisów i model kompetencji są danymi (`data/`), a struktura (`OrgUnit`) – drzewem, więc ta sama aplikacja obsłuży inny urząd po imporcie jego struktury i OSP.

## Stos technologiczny

| Warstwa | Technologia |
|---|---|
| Aplikacja (interfejs + API) | Next.js 15 (App Router), TypeScript w trybie ścisłym |
| Interfejs | Tailwind CSS 4, shadcn/ui (Radix), lucide-react |
| Walidacja | zod – wejście każdego endpointu i formularza |
| Baza danych | PostgreSQL 16 przez Prisma 6 |
| Uwierzytelnianie | Auth.js (next-auth v5), bcryptjs, sesja JWT w ciasteczku httpOnly |
| AI | własny klient API zgodnego z OpenAI (bez SDK), MiniSearch (BM25), pdfjs-dist (budowa bazy wiedzy) |
| Import plików | fflate + fast-xml-parser (docx i xlsx) |
| Testy | Vitest – silnik reguł, import, AI (z udawanym modelem), autoryzacja, logika ekranów; testy integracyjne na PostgreSQL (`TEST_DATABASE_URL`); zestaw testowy asystenta `npm run eval` |
| Hosting demo | Vercel + Neon (Frankfurt) |

## Decyzje

| Data | Decyzja | Powód |
|---|---|---|
| 21.11 | **PostgreSQL** lokalnie przez `docker compose`, na demo darmowa instancja zarządzana (np. Neon) | jedna baza w dev i na demo, gotowa pod wdrożenie w urzędzie; SQLite zostaje jako plan awaryjny |
| 21.11 | Prisma 6 (nie 7) | stabilna konfiguracja bez adapterów sterowników, mniej ryzyka w 16 godzin |
| 21.11 | Import xlsx własnym czytnikiem (`fflate` + `fast-xml-parser`) zamiast SheetJS / exceljs | plik MC zapisany przez Open XML SDK używa prefiksów przestrzeni nazw (`<x:c>`), których exceljs nie czyta; SheetJS w rejestrze npm (0.18.5) ma znane podatności. Potrzebujemy tylko tekstu komórek – ok. 160 linii kodu z testami |
| 21.11 | Import OSP własnym czytnikiem docx zamiast mammoth | OSP to formularz z polami wyboru (☒/☐), od których zależy arkusz oceny; mammoth zamienia dokument na HTML i gubi stan pól. Czytnik korzysta z tych samych `fflate` + `fast-xml-parser` co import xlsx |
| 21.11 | Jedna aplikacja Next.js zamiast osobnego backendu | szybsza praca zespołu, jeden deploy; API REST pod `/api/v1` gotowe do integracji z EZD i systemem kadrowym |

## Baza danych – zasady pracy

- Zmiana schematu = nowa migracja: `npx prisma migrate dev --name krotka_nazwa`. Nie edytujemy ani nie przemianowujemy migracji, które są już na `main`.
- Migracje wykonują się w kolejności nazw (znacznik czasu UTC). Migracja początkowa ma znacznik `20261121160000`, więc migracja utworzona przed 17:00 czasu polskiego 21.11 dostałaby wcześniejszą nazwę i wykonałaby się przed `init`. Taką migrację trzeba przemianować na późniejszy znacznik.
- Daty kalendarzowe (`@db.Date`) zapisujemy i odczytujemy przez `toDbDate` / `fromDbDate` z `src/lib/domain/daty.ts`, a dzisiejszą datę bierzemy z `todayIso()`. `new Date(rok, miesiąc, dzień)` w czasie lokalnym zapisze w bazie poprzedni dzień.
- Testy integracyjne modelu danych (`tests/db/`) uruchamiają się z `TEST_DATABASE_URL` wskazującym osobną, pustą bazę z zastosowanymi migracjami (`npx prisma migrate deploy`).

## Uwierzytelnianie i role (Z04)

- **Auth.js (next-auth v5)**, logowanie e-mailem i hasłem. Hasła hashowane bcrypt, sesja JWT w ciasteczku httpOnly (8 godzin).
- Role: `PRZELOZONY`, `HR`, `OCENIANY`, `KIERUJACY_KOMORKA` – jedna rola na konto.
- Ekrany ról i ich ścieżki: `src/lib/auth/role.ts` (`ROLE_HOME`, `PROTECTED_AREAS`). Nowy ekran roli = nowy wpis w `PROTECTED_AREAS`.
- **Trzy warstwy ochrony:**
  1. `src/middleware.ts` – niezalogowany trafia na `/logowanie`, ekran innej roli przekierowuje na własny;
  2. układy grup `(przelozony)`, `(hr)`, `(oceniany)`, `(kierujacy)` – `requirePageRole(...)` na serwerze;
  3. **każdy handler API i akcja serwerowa** sprawdza rolę sam (`src/lib/auth/guard.ts`). Bez sesji API zwraca 401, przy złej roli 403.

Jak zabezpieczyć nowy kod:

```ts
// handler API
export const GET = withRole(["HR", "PRZELOZONY"], async (req, ctx, user) => { … });

// akcja serwerowa
const user = await requireRole("PRZELOZONY"); // rzuca AccessError 401/403

// ekran (server component) – zwykle wystarczy layout grupy
const user = await requirePageRole("HR");
```

Przełożony widzi wyłącznie swoich podwładnych: zapytania filtrujemy po `supervisorId: user.id` (przykład: `/api/v1/pracownicy`).

## Model kompetencji (Z05)

- `npm run model` czyta `materialy/Model_kompetencji.xlsx` i zapisuje `data/model-kompetencji.json` (plik jest w repozytorium; aplikacja nie czyta xlsx w czasie działania). `npm run model -- --check` kończy się kodem 1, gdy JSON nie odpowiada plikowi xlsx; to samo sprawdza test.
- Data importu zmienia się tylko przy zmianie treści, więc ponowny import tego samego pliku nie daje zmian w git.
- Import jest ścisły: sprawdza nagłówki (wiersz 3), komplet 5 opisów zachowań w każdym wierszu, zgodność liczby wskaźników ze spisem w arkuszu „Model kompetencji” i z deklaracją „14 kompetencji • 49 wskaźników • 5 poziomów”, tytuły arkuszy, duplikaty i treść poniżej pustego wiersza. Zbiera wszystkie problemy naraz i podaje adres komórki, np. `„KOMUNIKACJA”!D3: oczekiwano nagłówka „na poziomie oczekiwań”…`. Ten sam kod może przyjąć nowy plik w panelu HR (Z19).
- Wynik: 14 kompetencji, 49 wskaźników, po 5 opisów zachowań i 3 wskazówki do oceny (`guidance`, do wyświetlenia przy ocenie w Z14). Nazwy wskaźników są identyczne z załącznikiem nr 1 do rozporządzenia – pilnuje tego test na danych przepisanych z PDF (`tests/import/zalacznik-1.ts`).
- Identyfikator wskaźnika: `KOD.numer` w kolejności z arkusza, np. `KOMUNIKACJA.2` (patrz `docs/ZALOZENIA.md` #15).
- Użycie w kodzie:
  ```ts
  import { competencyModel } from "@/lib/domain/model-kompetencji-dane";
  competencyModel.getCompetency("WSPOLPRACA").indicators; // 6 wskaźników
  competencyModel.getIndicator("KOMUNIKACJA.2")?.name;
  competencyModel.behaviorDescription("KOMUNIKACJA.2", 3); // opis karty „na poziomie oczekiwań”
  competencyModel.model.guidance; // wskazówki do oceny
  ```
- Schemat zod `competencyModelSchema` (`src/lib/domain/model-kompetencji.ts`) waliduje JSON przy starcie aplikacji, wynik importu i – w Z19 – edycję opisów zachowań w panelu HR.
- Czytnik `src/lib/import/xlsx.ts` (dla plików od użytkownika): limit 50 MB po rozpakowaniu, odrzucenie XML z `DOCTYPE`, odczyt tylko części wskazanych w relacjach skoroszytu.

## Import opisu stanowiska pracy i wybór arkusza (Z06)

- `parseOsp(plik)` z `src/lib/import/osp.ts` zwraca `PositionDescription`, automatyczny wybór arkusza (`sheet`), kandydatów na kryteria dodatkowe, pełny tekst (`rawText`, do `Position.rawText` i jako kontekst dla AI w Z23) oraz uwagi. Podgląd z wiersza poleceń: `npm run osp -- plik.docx`.
- Odczytywane pola: nazwa stanowiska, urząd, komórka (departament i wydział), symbol, stanowisko bezpośrednio nadzorujące, cel istnienia stanowiska, zadania dominujące i pozostałe (bez przedrostka „Zadanie N:”), liczba podległych, zaznaczone upoważnienia (z opisem „inne”), opisy złożoności i samodzielności, wymagana wiedza i „Kompetencje miękkie” zamienione na kody z modelu kompetencji.
- Sekcje szukamy po nagłówkach formularza, a nie po numerach wierszy, więc OSP z inną liczbą zadań lub dodatkowymi wierszami też się wczyta. Błąd importu tylko wtedy, gdy nie da się wybrać arkusza (brak sekcji, żadna albo kilka zaznaczonych opcji liczby podległych) albo brak nazwy stanowiska; braki w pozostałych sekcjach to uwagi.
- Wybór arkusza: `selectSheet(liczbaPodległych)` z `src/lib/rules/arkusz.ts` według `periodic.sheetBySubordinates` w `data/przepisy.json` (§ 3). Zwraca arkusz, kryteria obowiązkowe (§ 4) i wyjaśnienie, np. „Wybrano arkusz C, bo w OSP zaznaczono »brak podległych pracowników«”. Zmianę arkusza przez przełożonego zapisuje Z12 w dzienniku decyzji.
- `additionalCriteriaFromOsp`: kompetencje miękkie z OSP, które nie są obowiązkowe na wybranym arkuszu (np. starszy specjalista → Myślenie analityczne) – podpowiedź bez AI dla Z12 i punkt wyjścia dla Z23.
- Czytnik `src/lib/import/docx.ts` obsługuje pola wyboru Worda 2010+ (`w14:checkbox`), stare pola formularza (FORMCHECKBOX), znaki ☒/☐ i symbole Wingdings; pomija teksty zastępcze pustych kontrolek („Wybierz element.”). Wspólne zabezpieczenia plików od użytkownika (limit 50 MB, odrzucenie DOCTYPE) są w `src/lib/import/ooxml.ts`.

## Zabezpieczenia demo (Z44)

- `resetDemoData` (`src/lib/demo/reset.ts`) woła `seedDemoData` z Z26 (usuwa dane demo i tworzy je od nowa, konta zostają) i zapisuje `RESET_DEMO` w `AuditLog`. Poza `DEMO_MODE=true` rzuca `DemoResetDisabledError` i niczego nie zmienia.
- Akcja `resetDemoAction` (`src/lib/demo/actions.ts`): tylko HR; przycisk z potwierdzeniem w panelu HR (`ResetDemoCard`), widoczny tylko w trybie demo. Lokalnie reset trwa ok. 0,1 s.
- Zapasowe odpowiedzi AI: `src/lib/demo/demo-cache.ts` + `data/demo-cache.json`, podpięte w ścieżce błędu modelu asystenta formalnego (Z22) i analizy OSP (Z23); opis w `docs/AI.md`.
- Tryb bez AI: testy `tests/demo/demo-cache.test.ts` sprawdzają asystenta formalnego i analizę OSP dla wszystkich trzech OSP od MC bez modelu; pozostałe gotowe ekrany (dziennik, panel HR, kreator części I) nie wołają modelu.

## Panel HR, część 1 (Z18)

- Ekran `/hr` (rola HR): podsumowanie, tabela wszystkich ocen w urzędzie z filtrami etap / termin / komórka (parametry adresu, domyślnie oceny w toku, „Wszystkie” – także zakończone) i kolejka przypomnień. Wzór pisemnego zawiadomienia o zmianie terminu (§ 8) do druku: `/hr/zawiadomienie/[id]`.
- Terminy liczy zawsze silnik Z08 na podstawie danych pracownika i nieobecności (`src/lib/hr/panel.ts` → `currentDeadline`), a nie zapisane `Evaluation.dueDate` – nieobecność dopisana później od razu zmienia termin. Etap → termin: do rozpoczęcia – rozmowa rozpoczynająca (30 dni) albo wstępna (21 dni); w okresie oceny – 24 miesiące z wydłużeniami (art. 81 ust. 7); po ocenie negatywnej – ponowna ocena po 6 miesiącach od zapoznania się z oceną (art. 81 ust. 9); pierwsza ocena – najpóźniej miesiąc przed końcem umowy.
- Wydłużenie z powodem (np. „+44 dni: zwolnienie lekarskie 25.04–07.06.2026”) i rozwijane „Dlaczego ten termin?” z wyjaśnieniem silnika i podstawą prawną.
- Ostrzeżenie z art. 71 (dwie kolejne oceny negatywne) – wyłącznie informacja dla HR, bez automatycznej akcji.
- Przypomnienia (`Reminder`): treść z wyjaśnienia terminu (`reminderFor`), odbiorca – oceniający; „Dodaj przypomnienie” przy terminach do 30 dni / po terminie, raz o danym terminie (ponownie, gdy termin się zmieni). „Wyślij” to symulacja: `sentAt` + wpis `PRZYPOMNIENIE_WYSLANE` w `AuditLog`.
- Dostęp do bazy: `src/lib/hr/repo.ts`, akcje: `src/lib/hr/actions.ts` (rola HR w każdej akcji), komponenty: `src/components/hr/`.

## Dziennik obserwacji (Z13)

- Ekrany przełożonego: `/obserwacje` (oś czasu albo widok „Według wskaźników”, filtry osoba / kompetencja / okres w parametrach adresu – działają bez JavaScriptu i dają się udostępnić linkiem), `/obserwacje/nowa?osoba=…`, `/obserwacje/[id]` (edycja i usuwanie z potwierdzeniem).
- Logika bez bazy: `src/lib/obserwacje/dziennik.ts` – walidacja wpisu SDR (co najmniej jedno z pól, data nie z przyszłości, wskaźnik z modelu, poziom zachowania tylko przy wskaźniku), filtry, oś czasu (`groupByMonth`), widok przy wskaźnikach (`groupByIndicator`), `observationsForIndicator` i `noteCountsByIndicator` – dla Z14 (notatki obok kart zachowań) i Z09 (`hasNote`).
- Baza: `src/lib/obserwacje/repo.ts` – każde zapytanie ograniczone do podwładnych przełożonego (`employee.supervisorId`); cudza obserwacja wygląda jak nieistniejąca. Akcje serwerowe `src/lib/obserwacje/actions.ts` sprawdzają rolę (Z04) i przynależność pracownika przy każdym zapisie.
- Komponenty: `ObservationCard`, `IndicatorNotes` (do użycia w Z14), `ObservationForm` (poziom zachowania kartami z opisami, bez liczb), `JournalFilters` w `src/components/obserwacje/`.

## Szybka notatka (Z41)

- Okno `src/components/asystent/SzybkaNotatka.tsx`, montowane w `AppShell` dla przełożonego (`FEATURES.quickNote`), otwierane skrótem `N` i przyciskiem „Notatka” (zdarzenie `SHORTCUT_EVENTS.quickNote`).
- Logika: `src/lib/ai/funkcje/szybka-notatka.ts` – pseudonimizacja (`pseudonymize`, `restoreNames` ze wspólnego modułu `src/lib/ai/pseudonimizacja.ts`, Z34), propozycja (`proposeQuickNote`, z modelem i bez), walidacja zapisu (`validateQuickNote`; bez wskaźnika i SDR notatka też się zapisze – do przypięcia).
- Akcje serwerowe: `src/lib/obserwacje/szybka-notatka.ts` – tylko rola przełożonego i tylko własni podwładni; zapis do `Observation` (`originalText`, źródło `SZYBKA_AI` albo `RECZNA`) i decyzji AI do `AuditLog`.
- Szybka notatka (Z41) zapisze obserwację z `source = SZYBKA_AI` i `originalText`; dziennik już ją pokazuje (odznaka „Szybka notatka”, sekcja „Nieprzypięte do wskaźnika”).

## Analiza OSP: propozycja kryteriów dodatkowych (Z23)

- `proposeAdditionalCriteria(stanowisko, arkusz)` z `src/lib/ai/funkcje/kryteria-z-osp.ts` zwraca `{ mode: "AI" | "BEZ_AI", proposals: [{ competency, name, justification, quote: { text, source, taskNumber } }], notice? }`. Zabezpieczenia opisuje `docs/AI.md`.
- Endpoint `POST /api/asystent/kryteria`: `multipart/form-data` z polem `plik` (OSP .docx, do 5 MB) albo JSON `{ pracownikId }` (OSP z bazy); opcjonalnie `arkusz` = `B` | `C`, gdy przełożony zmienił arkusz wskazany przez OSP. Odpowiedź: `propozycja`, `arkusz` (wybór z OSP z wyjaśnieniem i polem `wybrany`), `stanowisko`, `uwagi` z importu.
- Błędy: 400 (brak pliku/pracownika, zły arkusz), 404 (pracownik spoza podwładnych przełożonego), 409 (pracownik bez OSP), 413 (plik za duży), 422 (plik nie jest poprawnym OSP – lista `problemy`), 429 (limit zapytań).
- Interfejs (Z12) pokazuje propozycje w `<PropozycjaAI>` z przyciskiem „Wstaw do formularza”; gdy `mode = "BEZ_AI"`, etykieta mówi, że to propozycja bez AI.

## Sugerowany poziom kompetencji (Z09)

- `suggestLevel(kompetencja, oceny, { evaluationType })` z `src/lib/rules/sugestia.ts` – czysta funkcja, parametry z `data/przepisy.json` (`behaviorToPoints`, `suggestion`), wskaźniki z modelu kompetencji (Z05).
- Wejście: oceny wskaźników `{ indicatorId, value: 1–5 | "BRAK_OBSERWACJI" | null, hasNote }` (null = jeszcze nieoceniony).
- Wynik (`LevelSuggestion`): `suggestedPoints` i `suggestedLevel` (albo null = brak podstaw), średnia, flaga remisu, rozkład wyborów, wiersze wskaźników do panelu „Dlaczego ten poziom?”, wyjaśnienia zwykłym językiem (wzór, zaokrąglenie) i ostrzeżenia ze stałymi kodami: `OCENA_1_PKT`, `BRAK_NOTATKI` (z `indicatorId`, do pokazania przy karcie), `NISKA_WIARYGODNOSC`, `SUGESTIA_1_PKT`, `REMIS_W_DOL`, `NIEOCENIONE_WSKAZNIKI`, `BRAK_PODSTAW`.
- `validateFinalDecision({ suggestion, finalPoints, justification })` – ocena ze skali, a przy różnicy od sugestii wymagane jedno zdanie powodu; `differsFromSuggestion` mówi, kiedy zapisać oba wpisy w dzienniku decyzji (Z14, Z35).
- Zaokrąglenie liczone na liczbach całkowitych (|suma − wartość × n|), więc remis 6,00 nie zależy od błędów liczb zmiennoprzecinkowych.

## Baza wiedzy asystenta formalnego (Z21)

- `npm run wiedza` czyta PDF-y z `materialy/` i zapisuje `data/wiedza/fragmenty.json` (plik jest w repozytorium, więc aplikacja nie potrzebuje PDF-ów w czasie działania).
- Podział: rozporządzenia według § i ustępów, załącznik nr 1 według kryteriów / elementów oceny, wzory arkuszy według części i pouczenia; poradniki KPRM według rozdziałów ze spisu treści (kawałki do ok. 1200 znaków); FAQ zespołu z `data/wiedza/faq.json`; model kompetencji z `data/model-kompetencji.json` (49 fragmentów, po jednym na wskaźnik; po zmianie modelu uruchom ponownie `npm run wiedza`).
- Metadane fragmentu: dokument, jednostka redakcyjna lub rozdział, strona, data aktu, publikator, plik źródłowy.
- Wyszukiwanie: `searchKnowledge(pytanie)` z `src/lib/ai/rag/search.ts` – BM25 (MiniSearch), bez polskich znaków, rdzeń słowa = 6 pierwszych liter (słowa 5–6-literowe bez ostatniej litery: ocena/ocenę → „ocen”). Zwraca `hits` i `sufficient`: przy `false` asystent ma odmówić („Nie znalazłem tej informacji w dostępnych źródłach…”). Progi (`MIN_COVERAGE`, `MIN_SCORE`) są założeniem; jakość mierzy zestaw testowy `npm run eval` (Z25, `docs/AI.md`).
- `citation(fragment)` daje gotowy opis źródła, np. „§ 5 ust. 2 – rozporządzenie o ocenach okresowych (Dz.U. 2016 poz. 470)”.
- Ustawy o służbie cywilnej nie ma jeszcze w bazie (brak w `materialy/`). Treść art. 81 i 83 jest dostępna pośrednio przez poradnik KPRM, pouczenie w arkuszach i FAQ.

## Pulpit przełożonego (Z11)

- `src/lib/dashboard/pulpit.ts` – czysta logika: otwarte terminy przełożonego według etapu bieżącej oceny (silnik Z08), karta „Do zrobienia” (3–5 spraw), lista podwładnych, wejścia w ścieżki. Testy: `tests/dashboard/`.
- `src/lib/dashboard/dane.ts` – odczyt z bazy, wyłącznie podwładni zalogowanego przełożonego (`Employee.supervisorId`); cudzy pracownik = 404.
- `src/lib/dashboard/actions.ts` – szybkie dodanie pracownika (zod, rola sprawdzana na serwerze, wpis w AuditLog) i podgląd pliku OSP (parser Z06).
- Linki z pulpitu prowadzą tylko do gotowych ekranów: `isScreenReady` w `src/lib/ui/nav.ts` sprawdza menu (`pending`). Rozmowa rozpoczynająca → kreator części I (Z12, „Ustal kryteria”); sporządzenie oceny okresowej (24 mies., ponowna po negatywnej, przy zmianie stanowiska) → zakończenie oceny (Z14, „Zakończ ocenę” / „Kontynuuj ocenę”); pierwsza ocena → karta pracownika `/pulpit/pracownik/[id]`, dopóki Z17 nie usunie `pending`. Linki do dziennika obserwacji (Z13): `/obserwacje?osoba=…` i `/obserwacje/nowa?osoba=…`.

**Zmiana w silniku terminów (Z08) – informacja dla właściciela Z08:** `buildTodoItems` w `src/lib/rules/terminy.ts` dopisuje rok do daty w tytule karty, gdy termin wypada w innym roku niż dzisiejszy: „termin minął 22.12.2025”, „do 05.01.2027”. W bieżącym roku format się nie zmienia („do pt. 27.11”), więc dotychczasowe testy Z08 przechodzą bez zmian. Powód: przy terminie sprzed roku sama data „22.12” była niejednoznaczna (wyszło przy dodaniu pracownika z datą zatrudnienia na czas nieokreślony sprzed roku). Ta sama zasada działa na liście pracowników na pulpicie (`formatDay` w `pulpit.ts`).

## Struktura katalogów

```
materialy/                 materiały MC (tylko do odczytu)
data/                      model kompetencji, parametry przepisów (przepisy.json), baza wiedzy (wiedza/), zapasowe odpowiedzi demo
prisma/                    schema.prisma, migracje, seed.ts, seed-dane/ (OSP do danych demo)
src/
  app/
    (auth)/                logowanie
    (przelozony)/          pulpit, ocena okresowa (kreator, ocena wskaźników, podsumowanie), dziennik obserwacji
    (hr)/                  panel HR, zawiadomienie o zmianie terminu
    (oceniany)/ (kierujacy)/
    api/v1/                REST API (status, me, pracownicy)
    api/asystent/          asystent formalny, kryteria z OSP
  components/              ui/ (komponenty bazowe), layout/, pulpit/, ocena/, obserwacje/, hr/, asystent/, auth/
  lib/
    domain/                typy, słownik, przepisy, model kompetencji, daty (kontrakt wspólny)
    rules/                 silnik reguł: arkusz, kryteria, punktacja, terminy, kalendarz, sugestia
    auth/                  role, strażnicy autoryzacji, konta demo
    import/                czytniki docx/xlsx, OSP, model kompetencji
    ai/llm/ ai/rag/ ai/funkcje/   dostawca modelu, baza wiedzy, asystent i kryteria z OSP
    dashboard/ ocena/ obserwacje/ hr/ demo/ audit/ ui/   logika i dostęp do danych ekranów, dziennik decyzji, nawigacja
    db.ts                  klient Prisma
  middleware.ts, auth.ts   sesja i obszary ról
scripts/                   import modelu, OSP, bazy wiedzy, eval asystenta, build produkcyjny
tests/                     testy (Vitest)
eval/                      zestaw testowy asystenta i wynik
docs/                      dokumentacja
```
