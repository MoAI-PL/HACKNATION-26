# Zasady UX i komponenty

Użytkownik korzysta z systemu kilka razy w roku i nie przejdzie szkolenia. **Każdy ekran ma być zrozumiały w 5 sekund.**
Podgląd wszystkich komponentów: **`/komponenty`** (po zalogowaniu dowolnym kontem, dane fikcyjne).

## Dziesięć zasad

1. **Pulpit to „co mam dziś zrobić”**, nie tabela: karta „Do zrobienia” z 3–5 sprawami, każda z jednym przyciskiem.
2. **Jedna główna akcja na ekranie** (`<Button>`), reszta jako `variant="outline" | "ghost" | "link"`.
3. **Kreator z paskiem postępu i autozapisem**: „Krok 3 z 6: Ocena wskaźników”, znacznik „Zapisano 14:32”. Nigdy „Utracisz niezapisane dane”.
4. **Prosty język z powodem**: „Ocena jest negatywna, bo jedna ocena cząstkowa wynosi 1 pkt (§ 11 ust. 1 pkt 4)”. Żargon w `<Term>`.
5. **Puste stany uczą**: `<EmptyState>` mówi, co tu będzie i jak to dodać.
6. **AI zawsze wygląda tak samo**: tylko `<PropozycjaAI>`.
7. **Mało klikania**: rozsądne wartości domyślne, karty zamiast list rozwijanych, skróty klawiaturowe.
8. **Status zawsze widoczny**: kolor + ikona + tekst, nigdy sam kolor.
9. **Dostępność WCAG 2.1 AA**: kontrast ≥ 4,5:1, obsługa klawiaturą z widocznym fokusem, etykiety pól, `aria-live`, jeden `h1`, cele kliknięcia ≥ 24 px.
10. **Spokojny, urzędowy wygląd**: Noto Sans, jasne tło, jeden kolor akcentu (granat), fiolet tylko dla AI. Bez logotypów i godła MC oraz gov.pl.

## Kolory (`src/app/globals.css`)

| Token (klasa Tailwind) | Wartość | Do czego |
|---|---|---|
| `primary` | `#1f4e8c` | akcent: główny przycisk, aktywne menu, linki, fokus |
| `foreground` / `muted-foreground` | `#1b1f24` / `#4f5b67` | tekst / tekst pomocniczy |
| `background` / `card` | `#f6f7f9` / `#ffffff` | tło strony / karty |
| `input` | `#7d8996` | obramowanie pól (kontrast ≥ 3:1) |
| `ai`, `ai-soft`, `ai-border` | `#6d28d9`, `#f5f1ff`, `#8b5cf6` | **wyłącznie** propozycje AI |
| `success`, `warning`, `danger`, `info` (+ `-soft`) | zielony, brązowo-pomarańczowy, czerwony, granat | statusy i komunikaty |

Kolorów statusów nie używamy do dekoracji. Nowy kolor dodajemy tylko jako token w `globals.css`.

## Komponenty

| Komponent | Plik | Kiedy używać |
|---|---|---|
| `AppShell`, `PageHeader` | `components/layout/AppShell.tsx` | układ każdego ekranu po zalogowaniu; `PageHeader` = jeden `h1` + jedna główna akcja |
| `Button` | `components/ui/button.tsx` | warianty: `default` (główna akcja), `outline`, `ghost`, `link`, `destructive`, `ai` (tylko w propozycjach AI) |
| `Card` … `CardFooter` | `components/ui/card.tsx` | grupowanie treści, karta „Do zrobienia” |
| `StatusBadge`, `DeadlineBadge`, `EvaluationStatusBadge` | `components/ui/status-badge.tsx` | etap oceny, termin (kolor wg `urgencyFromDaysLeft`) |
| `Notice` | `components/ui/notice.tsx` | komunikat z powodem, podstawą prawną i akcją; błędy/ostrzeżenia mają `role="alert"` |
| `EmptyState` | `components/ui/empty-state.tsx` | pusta lista z instrukcją i przyciskiem |
| `InfoTip`, `Term` | `components/ui/info-tip.tsx` | „ⓘ Dlaczego?” przy polach i krokach (treści: Z42), dymki żargonu ze słownika `GLOSSARY` |
| `Field`, `Input`, `Textarea` | `components/ui/field.tsx` | każde pole: etykieta, podpowiedź, błąd powiązane przez `aria-describedby` |
| `ChoiceCardGroup` | `components/ui/choice-cards.tsx` | pojedynczy wybór kartami: karty zachowań (Z14), arkusz B/C (Z12) |
| `ChoiceCardMulti` | `components/ui/choice-cards.tsx` | wybór wielokrotny z limitem: kryteria dodatkowe (maks. 3) |
| `WizardProgress`, `AutosaveIndicator`, `WizardFooter` | `components/ui/wizard.tsx` | kreatory (Z12, Z14, Z17) |
| `Dialog` | `components/ui/dialog.tsx` | okna (fokus w oknie, Esc zamyka) |
| `Skeleton` | `components/ui/skeleton.tsx` | ładowanie |
| `PropozycjaAI` | `components/asystent/PropozycjaAI.tsx` | **każda** propozycja AI (sekcja niżej) |

### Układ ekranu i menu

Layouty grup tras `(przelozony)`, `(kierujacy)`, `(hr)`, `(oceniany)` sprawdzają rolę (Z04) i owijają treść w `AppShell`:

```tsx
const user = await requirePageRole("PRZELOZONY");
return <AppShell user={shellUser(user)} userMenu={<LogoutButton />}>{children}</AppShell>;
```

- `AppShell` dostarcza jedyny `<main>`. Strona go **nie** dodaje: zaczyna się od `<PageHeader title="…" description="…" action={<Button>…</Button>} />`.
- Menu jest w `src/lib/ui/nav.ts`. Adresy leżą w obszarach ról z `src/lib/auth/role.ts` (test to sprawdza).
- **Bez martwych linków:** pozycja z `pending: "Z12"` jest ukryta, dopóki ekranu nie ma. Zadanie ekranu usuwa `pending` w commicie, który dodaje stronę.
- Docelowe menu przełożonego: Pulpit (`/pulpit`), Pierwsza ocena (`/ocena/pierwsza`, Z17), Ocena okresowa (`/ocena/okresowa`, Z12), Dziennik obserwacji (`/obserwacje`, Z13), Asystent formalny (`/asystent`), Asystent rozmowy (`/ocena/rozmowa`, Z24).
- Przycisk „Notatka” i skrót `N` są wyłączone do czasu Z41: Z41 ustawia `FEATURES.quickNote = true` w `nav.ts`.
- Asystent formalny (`/asystent`) jest na razie tylko w menu przełożonego, bo strona leży w grupie `(przelozony)`. Gdy trafi do wspólnego layoutu, dodajemy go też HR i kierującemu.

### `<PropozycjaAI>` – wspólny wzorzec AI (sekcja 4.2)

```tsx
<PropozycjaAI
  state={stan}                       // "ladowanie" | "gotowa" | "niedostepna"
  title="Kryteria dodatkowe"
  proposal={tekst}                   // edytowalny tekst; dla propozycji strukturalnych podaj children
  sources={[{ document: "Rozporządzenie o ocenach okresowych", unit: "§ 5 ust. 2", quote: "…" }]}
  onInsert={(t) => ustawPole(t)}
  onReject={() => …}
  onDecision={(d) => zapiszWAuditLog(d)}  // każde „Wstaw” i „Odrzuć” trafia do AuditLog z treścią propozycji
  onCancel={anuluj} onRetry={ponów}
/>
```

Gdy model nie odpowiada, ustaw `state="niedostepna"`. Komunikat jest spokojny i nic nie blokuje pracy.

## Skróty klawiaturowe

| Klawisz | Działanie | Gdzie | Jak podpiąć |
|---|---|---|---|
| `N` | szybka notatka | wszędzie (przełożony, po włączeniu w Z41) | `useShortcutEvent(SHORTCUT_EVENTS.quickNote, (e) => { e.preventDefault(); otwórz(); })` |
| `/` | asystent formalny | wszędzie (role z asystentem) | domyślnie przejście na `/asystent`; panel boczny może przejąć skrót: `useShortcutEvent(SHORTCUT_EVENTS.assistant, (e) => { e.preventDefault(); otwórz(); })` |
| `?` | lista skrótów | wszędzie | gotowe w `AppShell` |
| `←` `→` | poprzedni / następny wskaźnik | ocena wskaźników | `useShortcut("ArrowRight", …)` – Z14 |
| `1`–`5`, `0` | wybór zachowania / brak obserwacji | ocena wskaźników | `useShortcut("3", …)` – Z14 |
| `Esc` | zamknięcie okna | okna i panele | wbudowane w `Dialog`, `InfoTip` |

Skróty jednoklawiszowe nie działają podczas pisania w polu ani z Ctrl/Cmd/Alt (`src/lib/ui/shortcuts.ts`). Ten sam efekt dają przyciski w nagłówku (Notatka, Zapytaj asystenta).

## Kontrola jakości UX (przed statusem „gotowe”)

- [ ] Ekran ma jedną główną akcję i jasny tytuł (`PageHeader`).
- [ ] Działa bez myszy (Tab, Enter, Esc, skróty), fokus jest widoczny.
- [ ] Ma przemyślany stan pusty, ładowania i błędu.
- [ ] Komunikaty są po polsku, prostym językiem, z powodem.
- [ ] Działa przy szerokości 768 px i 1440 px (bez poziomego przewijania).
- [ ] Propozycje AI używają `<PropozycjaAI>`.

## Wyniki przeglądów

| Data | Co | Wynik |
|---|---|---|
| 21.11 | `/komponenty` przy 768 i 1440 px (przed podpięciem do layoutów ról) | brak poziomego przewijania, 1 `h1`, 1 `main`, wszystkie pola z etykietami, cele kliknięcia ≥ 24 px, skróty /, ?, 1–5 działają, fokus widoczny (skrót N wyłączony do Z41) |
| 21.11 | kontrast tokenów kolorów (obliczenie WCAG) | 22 z 23 par spełnia AA; wyjątek: ramka niezaznaczonej karty wyboru 1,4:1 (punkt 4 niżej) |
| 21.11 | `/obserwacje`, `/obserwacje/nowa`, edycja (Z13) przy 768 i 1440 px na danych demo | brak poziomego przewijania, 1 `h1`, 1 `main`, etykiety połączone z polami (`label for`, `aria-describedby`), błędy jako `role="alert"` i `aria-invalid`, wpisany tekst zostaje po błędzie walidacji, okno usuwania łapie fokus i mówi, że operacji nie można cofnąć |
| — | axe / Lighthouse (Z30) | do uzupełnienia |
| — | pomiar „pełna ocena w 15 minut” (Z30) | do uzupełnienia |

## Z10 – co zostało do 100%

Przegląd 21.11 wieczorem: Z10 działa i jest scalone, ale te punkty zostały otwarte. Kto bierze punkt, wpisuje się w nawiasie.

| # | Co | Dlaczego | Jak sprawdzić |
|---|---|---|---|
| 1 | **Przegląd nagłówka i menu po zalogowaniu** każdą rolą (przełożona, HR, kierujący, oceniany) przy 768 i 1440 px | `AppShell` w layoutach ról nie był jeszcze oglądany na żywo (brak lokalnej bazy z danymi). Obok imienia doszło „Wyloguj” – nagłówek może się inaczej zawijać | brak poziomego przewijania, jedno `main`, menu zgodne z rolą, „Wyloguj” działa |
| 2 | **`<PropozycjaAI>`: wymusić zapis do AuditLog** – `onDecision` obowiązkowy i wspólna akcja serwerowa (np. `logAiDecision`), która bierze użytkownika z sesji (Z04) | sekcja 4.2: każde „Wstaw” i „Odrzuć” trafia do AuditLog z treścią propozycji; dziś zależy to od pamięci autora funkcji AI | test akcji: wpis z `aiProposal` i `humanDecision`; brak `onDecision` = błąd typów |
| 3 | **Automatyczny przegląd dostępności** (axe DevTools / Lighthouse ≥ 90) na `/logowanie`, `/pulpit`, `/asystent`, `/komponenty` i poprawki | wymóg WCAG 2.1 AA, punkt na slajd; dziś sprawdzone tylko ręcznie | wynik wpisany w tabeli „Wyniki przeglądów” (wspólnie z Z30) |
| 4 | Ramka niezaznaczonej karty wyboru: `border-input` zamiast `border-border` | kontrast 1,4:1 < 3:1 (WCAG 1.4.11) | obliczony kontrast ≥ 3:1 |
| 5 | `AutosaveIndicator`: ogłaszać czytnikowi tylko „Zapisano …” i błąd, nie każde „Zapisywanie…” | przy pisaniu czytnik ekranu odczytuje komunikat po każdej zmianie | NVDA / VoiceOver – jeden komunikat po zapisie |
| 6 | Skrót `/` nie działa, gdy otwarte jest okno dialogowe | dziś `/` przy otwartym oknie (np. „Dodaj pracownika”) przenosi na stronę asystenta | test ręczny |
| 7 | `/komponenty`: użytkownik z sesji zamiast stałej „Ewy”, a na produkcji tylko przy `DEMO_MODE` | każda rola widzi tam menu przełożonego; strona nie jest dla jury | HR na `/komponenty` widzi menu HR; bez `DEMO_MODE` – 404 |
| 8 | Asystent formalny dla HR i kierującego – decyzja z Z04/Z22 | `role.ts` wpuszcza HR i kierującego na `/asystent`, ale strona leży w grupie `(przelozony)`, więc ich przekierowuje; w menu na razie tylko przełożony | po przeniesieniu strony do wspólnego layoutu dodać `ASYSTENT_FORMALNY` do menu HR i kierującego w `src/lib/ui/nav.ts` |
| 9 | Krótki przewodnik po pierwszym logowaniu (3 dymki, sekcja 4.3) | nie jest przypisany do żadnego zadania; Z10 dał komponenty, przewodnika nie ma | po pierwszym logowaniu przełożonej 3 pomijalne dymki, potem już nie |

**Zależne od innych zadań (bez zmian w Z10):** Z41 włącza „Notatkę” i skrót N (`FEATURES.quickNote = true` w `src/lib/ui/nav.ts`); każde zadanie ekranu (Z12, Z13, Z17, Z24) usuwa `pending` ze swojej pozycji menu w tym samym commicie, który dodaje stronę.
