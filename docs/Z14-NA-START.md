# Z14 – na start: co jest gotowe w `main`

Krótka ściąga dla osoby, która bierze Z14 (zakończenie oceny: karty zachowań, sugestia, decyzja przełożonego).
Wszystko poniżej jest w `main`, ma testy i opis w `docs/ARCHITEKTURA.md`. Nie trzeba niczego pisać od zera.

## 1. Model kompetencji – wskaźniki i opisy zachowań (Z05)

```ts
import { competencyModel } from "@/lib/domain/model-kompetencji-dane";

competencyModel.getCompetency("KOMUNIKACJA").indicators;   // wskaźniki kryterium w kolejności z modelu
competencyModel.behaviorDescription("KOMUNIKACJA.2", 3);    // tekst karty „na poziomie oczekiwań”
competencyModel.model.guidance;                              // 3 wskazówki z modelu do pokazania przy ocenie (sekcja 8.4)
```

- Identyfikator wskaźnika: `KOD.numer`, np. `KOMUNIKACJA.2`. To samo pole jest w `IndicatorRating.indicatorId` i `Observation.indicatorId`.
- Etykiety poziomów: `LEVEL_LABELS` i `BEHAVIOR_LEVEL_TO_LEVEL` z `@/lib/domain/slownik`, „brak okazji do obserwacji”: `NO_OBSERVATION_LABEL`.

## 2. Notatki z dziennika obok kart zachowań (Z13)

```ts
import { listObservations } from "@/lib/obserwacje/repo";                    // zapytanie ograniczone do podwładnych przełożonego
import { observationsForIndicator, noteCountsByIndicator } from "@/lib/obserwacje/dziennik";
import { IndicatorNotes } from "@/components/obserwacje/ObservationCard";

const obserwacje = await listObservations(user.id, { employeeId });      // raz na ocenę
const przyWskazniku = observationsForIndicator(obserwacje, employeeId, "KOMUNIKACJA.2");
<IndicatorNotes observations={przyWskazniku} />                          // gotowa lista notatek SDR (h4, bez nazwiska i wskaźnika)

const notatki = noteCountsByIndicator(obserwacje, employeeId);           // Map<indicatorId, liczba> → hasNote dla sugestii
```

- Okres oceny: przekaż `from` / `to` w filtrach `listObservations`, jeśli notatki mają być tylko z okresu podlegania ocenie.
- Pusty stan przy wskaźniku jest wbudowany w `IndicatorNotes` („Brak notatek przy tym wskaźniku.”), można podać własny tekst `emptyText`.

## 3. Sugerowany poziom i panel „Dlaczego ten poziom?” (Z09)

```ts
import { suggestLevel, validateFinalDecision } from "@/lib/rules/sugestia";

const sugestia = suggestLevel("KOMUNIKACJA", [
  { indicatorId: "KOMUNIKACJA.1", value: 4, hasNote: (notatki.get("KOMUNIKACJA.1") ?? 0) > 0 },
  { indicatorId: "KOMUNIKACJA.2", value: "BRAK_OBSERWACJI", hasNote: false },
  // wskaźnik jeszcze nieoceniony: value: null albo pominięty
], { evaluationType: "OKRESOWA" });   // albo "PIERWSZA" (skala 3/5/7) – przyda się w Z17
```

Wynik (`LevelSuggestion`) ma wszystko do panelu:

| Pole | Do czego |
|---|---|
| `suggestedPoints`, `suggestedLevel` | sugestia (null = brak podstaw – nie pokazuj liczby, pokaż ostrzeżenie `BRAK_PODSTAW`) |
| `indicators` | wiersze panelu: nazwa wskaźnika, wybór, punkty, czy jest notatka |
| `distribution` | rozkład wyborów 1–5 i „brak okazji do obserwacji” |
| `explanations` | wzór zwykłym językiem, np. „(7 + 5 + 7) : 3 = 6,33 pkt”, i zaokrąglenie |
| `warnings` | stałe kody: `OCENA_1_PKT`, `BRAK_NOTATKI`, `NISKA_WIARYGODNOSC`, `SUGESTIA_1_PKT`, `REMIS_W_DOL`, `NIEOCENIONE_WSKAZNIKI`, `BRAK_PODSTAW`; ostrzeżenia z `indicatorId` pokazuj przy karcie tego wskaźnika |

Decyzja przełożonego:

```ts
const v = validateFinalDecision({ suggestion: sugestia, finalPoints: 5, justification });
// v.valid, v.errors (zdania po polsku), v.justificationRequired, v.differsFromSuggestion
```

- Gdy `differsFromSuggestion`, zapisz oba wpisy: `EvaluationCriterion.suggestedScore` (sugestia), `score` (decyzja), `overrideReason` (powód) **i** wpis w `AuditLog` z `action: "ZMIANA_SUGESTII"` (wzorzec zapisu do `AuditLog` jest w `src/app/(przelozony)/ocena/okresowa/actions.ts` z Z12).
- Powód musi mieć co najmniej 10 znaków (`MIN_JUSTIFICATION_LENGTH`, założenie #16 w `docs/ZALOZENIA.md`).
- Punkty → wynik całej oceny liczy już Z07: `scorePeriodic` z `@/lib/rules/punktacja` (to Z15).

## 4. Komponenty interfejsu (Z10)

- `ChoiceCardGroup` (`@/components/ui/choice-cards`) – 5 kart zachowań + karta „brak okazji do obserwacji”, **bez liczb na kartach** (wyróżnik ②).
- Skróty klawiaturowe: `useShortcut("1", …)` … `useShortcut("5", …)`, `"0"` dla braku obserwacji, `ArrowLeft` / `ArrowRight` – poprzedni/następny wskaźnik (`@/components/layout/useShortcut`, opis w `docs/UX.md`).
- Kreator: `WizardProgress`, `AutosaveIndicator`, `WizardFooter` (`@/components/ui/wizard`), komunikaty: `Notice`, odznaki: `StatusBadge`.
- Pozycja menu i strona: ocena okresowa jest pod `/ocena/okresowa/[id]` (Z12); dostęp do oceny: `evaluationAccess(user.id)` z `@/lib/ocena/dane-kreatora`.

## 5. Zapis ocen wskaźników w bazie

- `IndicatorRating` (`criterionId`, `indicatorId`, `level` 1–5, `note`): `level = null` oznacza „brak okazji do obserwacji”, brak wiersza = wskaźnik jeszcze nieoceniony (założenie #10).
- `EvaluationCriterion` ma już pola `score`, `suggestedScore`, `overrideReason`.

## 6. Na co uważać (sprawdzone w Z13)

- **React 19 czyści formularz po akcji serwerowej.** Przy błędzie walidacji zwracaj wpisane wartości w stanie akcji i podawaj je jako `defaultValue` (wzorzec: `src/lib/obserwacje/actions.ts` i `ObservationForm.tsx`, klucz formularza `key={state?.attempt}`) – inaczej użytkownik straci wpisany tekst.
- **Autoryzacja w każdej akcji serwerowej** (`requireRole("PRZELOZONY")`) i zapytania zawsze z warunkiem dostępu do oceny / podwładnych – samo ukrycie przycisku nie wystarcza.
- `next build` przy działającym `npm run dev` psuje katalog `.next` (błędy 500 w dev). Po buildzie: zatrzymaj dev, `rm -rf .next`, uruchom ponownie.
- Lokalnie: `npm run db:up`, `npx prisma migrate deploy`, `npm run seed` – w danych demo jest 32 obserwacji przypiętych do wskaźników, więc karty zachowań od razu mają notatki obok.
