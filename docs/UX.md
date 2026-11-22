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
8. **Status zawsze widoczny**: kolor + ikona + tekst, nigdy sam kolor. **Jeden język kolorów**: każda odznaka jest wyraźna – pełne tło i biały tekst. Termin (pilność): czerwony (pilne, po terminie), pomarańczowy (wkrótce), zielony (w terminie); etap oceny: granat z ikoną etapu, zakończona – zielona; pozostałe: szary, propozycja AI: fiolet. Każdy kolor ma jeden odcień w odznakach, komunikatach i tekście (`src/components/ui/status-badge.tsx`, tokeny w `globals.css`).
9. **Dostępność WCAG 2.1 AA**: kontrast ≥ 4,5:1, obsługa klawiaturą z widocznym fokusem, etykiety pól, `aria-live`, jeden `h1`, cele kliknięcia ≥ 24 px. Przycisk „Dostępność” (`UstawieniaWyswietlania`) daje tekst 125% i 150%, wysoki kontrast oraz motyw jasny / ciemny / jak w systemie (klasa `.dark`, domyślnie jasny; wydruk zawsze jasny) (`src/lib/ui/dostepnosc.ts`, style w `globals.css`); stopka prowadzi do `/deklaracja-dostepnosci`. **Progi `sm:`/`md:` nie rosną razem z powiększonym tekstem** (media queries liczą się od domyślnej czcionki przeglądarki) – siatki kafelków i kart budujemy z `grid-cols-[repeat(auto-fit,minmax(…rem,1fr))]` albo `flex-wrap` z `flex-[1_1_…rem]`, żeby przy 150% same przechodziły do nowego wiersza.
10. **Spokojny, urzędowy wygląd**: Open Sans (jak portal gov.pl), jasne tło, jeden kolor akcentu (granat), fiolet tylko dla AI. Bez logotypów i godła MC oraz gov.pl.

## Kolory (`src/app/globals.css`)

| Token (klasa Tailwind) | Wartość | Do czego |
|---|---|---|
| `primary` | `#1f4e8c` | akcent: główny przycisk, aktywne menu, linki, fokus |
| `foreground` / `muted-foreground` | `#1b1f24` / `#4f5b67` | tekst / tekst pomocniczy |
| `background` / `card` | `#f6f7f9` / `#ffffff` | tło strony / karty |
| `input` | `#7d8996` | obramowanie pól (kontrast ≥ 3:1) |
| `ai`, `ai-soft`, `ai-border` | `#6d28d9`, `#f5f1ff`, `#8b5cf6` | **wyłącznie** propozycje AI |
| `success`, `warning`, `danger`, `info` (+ `-soft`) | zielony, brązowo-pomarańczowy, czerwony, granat | statusy i komunikaty |
| `warning-strong` | `#c2410c` | tło pomarańczowej odznaki pilności z białym tekstem (jako tekst – `warning`) |

Kolorów statusów nie używamy do dekoracji. Nowy kolor dodajemy tylko jako token w `globals.css`.

## Komponenty

| Komponent | Plik | Kiedy używać |
|---|---|---|
| `AppShell`, `PageHeader` | `components/layout/AppShell.tsx` | układ każdego ekranu po zalogowaniu; `PageHeader` = jeden `h1` + jedna główna akcja |
| `Button` | `components/ui/button.tsx` | warianty: `default` (główna akcja), `outline`, `ghost`, `link`, `destructive`, `ai` (tylko w propozycjach AI) |
| `Card` … `CardFooter` | `components/ui/card.tsx` | grupowanie treści, karta „Do zrobienia” |
| `StatusBadge`, `DeadlineBadge`, `EvaluationStatusBadge` | `components/ui/status-badge.tsx` | etap oceny, termin (kolor wg `urgencyFromDaysLeft`); `size="md"` – większa odznaka; `variant="solid"` – pełne kolorowe tło i biały tekst (karta „Do zrobienia”) |
| `Notice` | `components/ui/notice.tsx` | komunikat z powodem, podstawą prawną i akcją; błędy/ostrzeżenia mają `role="alert"` |
| `EmptyState` | `components/ui/empty-state.tsx` | pusta lista z instrukcją i przyciskiem |
| `InfoTip`, `Term` | `components/ui/info-tip.tsx` | „ⓘ Dlaczego?” przy polach i krokach (treści: przepisy w kontekście), dymki żargonu ze słownika `GLOSSARY` |
| `Dlaczego` | `components/ui/dlaczego.tsx` | „ⓘ Dlaczego?” z treścią z `data/podpowiedzi.json`: `<Dlaczego id="KRYTERIA_DODATKOWE" />` – wyjaśnienie, podstawa prawna, dosłowny cytat z bazy wiedzy, link do ISAP; temat w nazwie przycisku dla czytnika ekranu |
| `Field`, `Input`, `Textarea` | `components/ui/field.tsx` | każde pole: etykieta, podpowiedź, błąd powiązane przez `aria-describedby` |
| `ChoiceCardGroup` | `components/ui/choice-cards.tsx` | pojedynczy wybór kartami: karty zachowań, arkusz B/C |
| `ChoiceCardMulti` | `components/ui/choice-cards.tsx` | wybór wielokrotny z limitem: kryteria dodatkowe (maks. 3) |
| `WizardProgress`, `AutosaveIndicator`, `WizardFooter` | `components/ui/wizard.tsx` | kreatory |
| `Dialog` | `components/ui/dialog.tsx` | okna (fokus w oknie, Esc zamyka) |
| `Skeleton` | `components/ui/skeleton.tsx` | ładowanie |
| `PropozycjaAI` | `components/asystent/PropozycjaAI.tsx` | **każda** propozycja AI (sekcja niżej) |

### Układ ekranu i menu

Layouty grup tras `(przelozony)`, `(kierujacy)`, `(hr)`, `(oceniany)` sprawdzają rolę i owijają treść w `AppShell`:

```tsx
const user = await requirePageRole("PRZELOZONY");
return <AppShell user={shellUser(user)} userMenu={<LogoutButton />}>{children}</AppShell>;
```

- `AppShell` dostarcza jedyny `<main>`. Strona go **nie** dodaje: zaczyna się od `<PageHeader title="…" description="…" action={<Button>…</Button>} />`.
- Menu jest w `src/lib/ui/nav.ts`. Adresy leżą w obszarach ról z `src/lib/auth/role.ts` (test to sprawdza).
- **Bez martwych linków:** pozycja z `pending: "kreator oceny okresowej"` jest ukryta, dopóki ekranu nie ma. Zadanie ekranu usuwa `pending` w commicie, który dodaje stronę.
- Docelowe menu przełożonego: Pulpit (`/pulpit`), Pierwsza ocena (`/ocena/pierwsza`), Ocena okresowa (`/ocena/okresowa`), Dziennik obserwacji (`/obserwacje`), Asystent formalny (`/asystent`), Asystent rozmowy (`/ocena/rozmowa`).
- Przycisk „Notatka” i skrót `N` – szybka notatka, włączone (`FEATURES.quickNote = true` w `nav.ts`).
- Asystent formalny (`/asystent`) leży we wspólnej grupie `(wspolne)` i jest w menu przełożonego, HR i kierującego.
- Nieistniejący adres i rekord spoza uprawnień pokazują polską stronę „Nie znaleziono strony” (`src/app/not-found.tsx`), a nieoczekiwany błąd – „Coś poszło nie tak” z przyciskiem „Spróbuj ponownie” (`src/app/error.tsx`).

### `<PropozycjaAI>` – wspólny wzorzec AI

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
| `N` | szybka notatka | wszędzie (przełożony) | `useShortcutEvent(SHORTCUT_EVENTS.quickNote, (e) => { e.preventDefault(); otwórz(); })` |
| `/` | asystent formalny | wszędzie (role z asystentem) | domyślnie przejście na `/asystent`; panel boczny może przejąć skrót: `useShortcutEvent(SHORTCUT_EVENTS.assistant, (e) => { e.preventDefault(); otwórz(); })` |
| `?` | lista skrótów | wszędzie | gotowe w `AppShell` |
| `←` `→` | poprzedni / następny wskaźnik | ocena wskaźników | `useShortcut("ArrowRight", …)` – ocena wskaźników |
| `1`–`5`, `0` | wybór zachowania / brak obserwacji | ocena wskaźników | `useShortcut("3", …)` – ocena wskaźników |
| `Esc` | zamknięcie okna | okna i panele | wbudowane w `Dialog`, `InfoTip` |

Skróty jednoklawiszowe nie działają podczas pisania w polu ani z Ctrl/Cmd/Alt (`src/lib/ui/shortcuts.ts`). Ten sam efekt dają przyciski w nagłówku (Notatka, Zapytaj asystenta).

## Kontrola jakości UX każdego ekranu

- [ ] Ekran ma jedną główną akcję i jasny tytuł (`PageHeader`).
- [ ] Działa bez myszy (Tab, Enter, Esc, skróty), fokus jest widoczny.
- [ ] Ma przemyślany stan pusty, ładowania i błędu.
- [ ] Komunikaty są po polsku, prostym językiem, z powodem.
- [ ] Działa przy szerokości 768 px i 1440 px (bez poziomego przewijania).
- [ ] Propozycje AI używają `<PropozycjaAI>`.

## Wyniki przeglądów

| Data | Co | Wynik |
|---|---|---|
| 21.11 | `/komponenty` przy 768 i 1440 px (przed podpięciem do layoutów ról) | brak poziomego przewijania, 1 `h1`, 1 `main`, wszystkie pola z etykietami, cele kliknięcia ≥ 24 px, skróty /, ?, 1–5 działają, fokus widoczny (skrót N wyłączony do szybkiej notatki) |
| 21.11 | kontrast tokenów kolorów (obliczenie WCAG) | 22 z 23 par spełnia AA; wyjątek: ramka niezaznaczonej karty wyboru 1,4:1 (punkt 4 niżej) |
| 21.11 | `/obserwacje`, `/obserwacje/nowa`, edycja przy 768 i 1440 px na danych demo | brak poziomego przewijania, 1 `h1`, 1 `main`, etykiety połączone z polami (`label for`, `aria-describedby`), błędy jako `role="alert"` i `aria-invalid`, wpisany tekst zostaje po błędzie walidacji, okno usuwania łapie fokus i mówi, że operacji nie można cofnąć |
| 21.11 | `/hr` i `/hr/zawiadomienie/[id]` przy 768 i 1440 px na danych demo, jako HR | brak poziomego przewijania strony i tabeli (odznaki etapu zawijają tekst), 1 `h1`, 1 `main`, tabela z `caption`, nagłówkami kolumn i wierszy, terminy kolorem i tekstem, „Dlaczego ten termin?” jako `details`, komunikaty po akcji jako `role="status"` |
| 21.11 | `/ocena/rozmowa` i ściąga przy 768 i 1440 px na danych demo, jako przełożona | brak poziomego przewijania, 1 `h1`, 1 `main`, przełącznik rodzaju rozmowy z `aria-current`, sekcje z nagłówkami `h2`, bez modelu spokojny komunikat w `<PropozycjaAI>`, nagłówek aplikacji ukryty przy druku |
| 21.11, 23:00 | axe-core (WCAG 2.1 A/AA) automatycznie, Playwright: 18 ekranów × 4 role (logowanie, pulpit, karta pracownika, ocena okresowa – lista, część I, ocena wskaźników, podsumowanie; dziennik, asystent, panel HR, kierujący, moje oceny, komponenty) | **0 naruszeń**; 36 widoków (768 i 1440 px): 0 błędów konsoli, bez poziomego przewijania, 1 `h1`, 1 `main`, wylogowanie działa w każdej roli. Poprawione przy przeglądzie: przyciski kont demo na logowaniu przy 768 px wychodziły poza karty |
| 22.11, 00:45 | testy end-to-end Playwright (`npm run e2e`): 4 role, 16 ekranów przy 768 i 1440 px (przełożona: pulpit, karta pracownika, dziennik i nowa obserwacja, ocena okresowa – lista, część I, ocena wskaźników, podsumowanie, asystent rozmowy, ściąga, tryb rozmowy, asystent formalny; HR: panel, dziennik decyzji, lustro, asystent), tryb rozmowy od startu do zapisu, pełna ocena okresowa z PDF | **11/11 testów**, 0 naruszeń axe (WCAG 2.1 A/AA), 1 `h1` i 1 `main` na każdym ekranie, bez poziomego przewijania, 0 błędów konsoli; złe hasło i wejście przełożonej do panelu HR odrzucone; pełna ocena (7 kryteriów, 25 wskaźników) do „Ocena sporządzona” i arkusz PDF (`application/pdf`) – 7 s czasu technicznego. Poprawione: tryb rozmowy nie miał `h1` w trakcie rozmowy |
| 22.11, 00:55 | pomiar „pełna ocena w 15 minut”: ocena okresowa Katarzyny Wójcik od „Oceń” do „Ocena sporządzona” – 7 kryteriów, 25 wskaźników, karty zachowań z notatkami, decyzje, podsumowanie i wnioski do IPRZ, stoper | **2 min 35 s** – członek zespołu, który znał już ekran i szybko czyta (dolna granica, nie wynik typowego użytkownika). Szacunek zespołu dla osoby widzącej ekran pierwszy raz: **ok. 8 minut** (co najmniej 5 minut więcej na czytanie opisów zachowań i notatek) – szacunek, nie pomiar; do sprawdzenia z osobą spoza zespołu. Uwagi: wszystko jasne, nic nie spowalniało. Cel 15 minut spełniony także przy tym szacunku |
| 22.11, 06:45 | ustawienia wyświetlania i deklaracja dostępności: axe-core (WCAG 2.1 A/AA) na pulpicie, dzienniku obserwacji, pierwszej ocenie, deklaracji i otwartym panelu „Dostępność” – domyślnie, przy 150% z wysokim kontrastem i przy 125%; sprawdzenie szerokości 375 i 874 px na ekranach przełożonej, HR i logowania | **0 naruszeń**, bez poziomego przewijania. Poprawione przy przeglądzie: przy 150% kafelki panelu HR i karty kont demo na logowaniu nie mieściły tekstu (stałe kolumny `md:`), na telefonie nie zawijały się przyciski nagłówka, przycisk akcji na pulpicie i przełącznik widoku dziennika; przyciski A/A+/A++ miały nazwę dostępną bez widocznego napisu (WCAG 2.5.3) |
| — | Lighthouse | nie wykonano – dostępność sprawdza automatycznie axe w testach end-to-end (wiersz wyżej) |
