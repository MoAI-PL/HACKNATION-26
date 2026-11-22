import type { Metadata } from "next";
import Link from "next/link";
import { Compass } from "lucide-react";
import { UstawieniaWyswietlania } from "@/components/layout/UstawieniaWyswietlania";
import { SHORTCUTS } from "@/lib/ui/shortcuts";

// Deklaracja dostępności według art. 10 ustawy z 4 kwietnia 2019 r. o dostępności cyfrowej stron internetowych
// i aplikacji mobilnych podmiotów publicznych (Dz.U. 2019 poz. 848) i wzoru ministra cyfryzacji.
// Strona otwarta dla wszystkich – także bez logowania i po zalogowaniu (OPEN_PATHS w src/lib/auth/role.ts).
// To prototyp: urząd, który wdroży aplikację, uzupełnia swoją nazwę, adres strony i dane kontaktowe.

export const metadata: Metadata = { title: "Deklaracja dostępności – Kompas Kompetencji" };

const PUBLISHED = "22 listopada 2026 r.";
const UPDATED = "22 listopada 2026 r.";
const REPO = "https://github.com/MoAI-PL/HACKNATION-26";

export default function DeklaracjaDostepnosciPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#tresc"
        className="sr-only z-50 rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Przejdź do treści
      </a>
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2 text-foreground no-underline">
            <Compass className="size-7 text-primary" aria-hidden />
            <span className="text-lg font-semibold tracking-tight">Kompas Kompetencji</span>
          </Link>
          <UstawieniaWyswietlania />
        </div>
      </header>

      <main id="tresc" tabIndex={-1} className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 md:px-6">
        <article className="flex flex-col gap-8 [&_h2]:mb-3 [&_h2]:text-xl [&_li]:ml-5 [&_li]:list-disc [&_p]:max-w-3xl [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
          <header className="flex flex-col gap-2">
            <h1 className="text-3xl">Deklaracja dostępności</h1>
            <p className="text-lg text-muted-foreground">
              Kompas Kompetencji zobowiązuje się zapewnić dostępność swojej aplikacji internetowej zgodnie z ustawą z dnia 4 kwietnia 2019 r. o
              dostępności cyfrowej stron internetowych i aplikacji mobilnych podmiotów publicznych.
            </p>
          </header>

          <section>
            <h2>Informacje o aplikacji</h2>
            <ul>
              <li>Aplikacja: Kompas Kompetencji – wsparcie przełożonego w pierwszej ocenie i ocenie okresowej w służbie cywilnej.</li>
              <li>Data publikacji aplikacji: {PUBLISHED}</li>
              <li>Data ostatniej istotnej aktualizacji: {UPDATED}</li>
              <li>
                Aplikacja jest prototypem przygotowanym na HackNation 2026 i działa na danych fikcyjnych. Urząd, który ją wdroży, uzupełnia w
                tej deklaracji swoją nazwę, adres strony i dane kontaktowe.
              </li>
            </ul>
          </section>

          <section>
            <h2>Stan dostępności cyfrowej</h2>
            <p>
              Aplikacja jest <strong>częściowo zgodna</strong> z ustawą o dostępności cyfrowej z powodu niezgodności lub wyłączeń wymienionych
              poniżej. Celem jest pełna zgodność z WCAG 2.1 na poziomie AA.
            </p>
          </section>

          <section>
            <h2>Treści niedostępne</h2>
            <ul>
              <li>
                Arkusze ocen w formacie PDF (wzory z rozporządzenia) nie mają struktury znaczników, więc czytnik ekranu odczytuje je jako ciągły
                tekst. Te same informacje są dostępne na ekranach aplikacji.
              </li>
              <li>
                Propozycje przygotowane przez sztuczną inteligencję mogą zawierać sformułowania wymagające poprawy – zawsze są oznaczone, a
                przełożony decyduje, czy je wstawić.
              </li>
              <li>Aplikacja nie ma wersji w polskim języku migowym ani tekstu łatwego do czytania (ETR).</li>
            </ul>
          </section>

          <section>
            <h2>Przygotowanie deklaracji</h2>
            <p>
              Deklarację sporządzono {PUBLISHED} na podstawie samooceny zespołu. Każdy ekran ścieżki demo sprawdzają automatyczne testy
              (axe-core, kryteria WCAG 2.1 A i AA) przy szerokości 768 i 1440 pikseli, razem z kontrolą jednego nagłówka głównego, jednego
              regionu treści i braku poziomego przewijania.
            </p>
          </section>

          <section>
            <h2>Ułatwienia w aplikacji</h2>
            <ul>
              <li>Przycisk „Dostępność” w nagłówku: większy tekst (125% i 150%) i wysoki kontrast. Ustawienie zapamiętuje przeglądarka.</li>
              <li>Link „Przejdź do treści” – pierwszy element na każdej stronie, widoczny po naciśnięciu klawisza Tab.</li>
              <li>Widoczny fokus na każdym elemencie, obsługa całej aplikacji klawiaturą, etykiety wszystkich pól formularzy.</li>
              <li>Kontrast tekstu co najmniej 4,5:1; status nigdy nie jest przekazywany samym kolorem – zawsze także tekstem i ikoną.</li>
              <li>Komunikaty o zapisie i błędach są odczytywane przez czytniki ekranu; aplikacja respektuje ustawienie ograniczenia animacji.</li>
              <li>Aplikacja działa po powiększeniu strony w przeglądarce do 200% i na ekranach od 320 pikseli szerokości.</li>
            </ul>
          </section>

          <section>
            <h2>Skróty klawiaturowe</h2>
            <p className="mb-3">Pełną listę pokazuje klawisz „?” na każdym ekranie po zalogowaniu.</p>
            <div className="max-w-2xl overflow-x-auto" tabIndex={0} role="region" aria-label="Tabela skrótów klawiaturowych">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Skróty klawiaturowe</caption>
              <thead>
                <tr className="border-b text-left">
                  <th scope="col" className="py-2 pr-4">Klawisz</th>
                  <th scope="col" className="py-2 pr-4">Działanie</th>
                  <th scope="col" className="py-2">Gdzie</th>
                </tr>
              </thead>
              <tbody>
                {SHORTCUTS.map((s) => (
                  <tr key={s.description} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-mono">{s.keys.join(" ")}</td>
                    <td className="py-2 pr-4">{s.description}</td>
                    <td className="py-2">{s.scope}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </section>

          <section>
            <h2>Informacje zwrotne i dane kontaktowe</h2>
            <p>
              Problemy z dostępnością prototypu można zgłaszać w repozytorium projektu:{" "}
              <a href={`${REPO}/issues`} rel="noopener noreferrer">
                zgłoszenia w repozytorium Kompas Kompetencji
              </a>
              . We wdrożeniu w urzędzie w tym miejscu podaje się osobę do kontaktu, adres e-mail i numer telefonu.
            </p>
            <p className="mt-3">
              Każdy ma prawo wystąpić z żądaniem zapewnienia dostępności cyfrowej aplikacji albo jej elementu, a także zażądać udostępnienia
              informacji w formie alternatywnej, na przykład odczytania niedostępnego dokumentu lub opisania zawartości ilustracji.
            </p>
          </section>

          <section>
            <h2>Procedura wnioskowo-skargowa</h2>
            <ul>
              <li>Żądanie powinno zawierać dane kontaktowe osoby zgłaszającej, wskazanie strony lub elementu oraz sposób kontaktu.</li>
              <li>Podmiot publiczny realizuje żądanie niezwłocznie, nie później niż w ciągu 7 dni od dnia jego wystąpienia.</li>
              <li>
                Jeżeli dotrzymanie tego terminu nie jest możliwe, podmiot niezwłocznie informuje o tym, kiedy realizacja będzie możliwa – nie
                później niż w ciągu 2 miesięcy od dnia wystąpienia z żądaniem.
              </li>
              <li>Jeżeli zapewnienie dostępności nie jest możliwe, podmiot może zaproponować alternatywny sposób dostępu do informacji.</li>
              <li>
                Po odmowie albo przy niedotrzymaniu terminów osoba zgłaszająca może złożyć skargę do podmiotu, a następnie wniosek do Rzecznika
                Praw Obywatelskich.
              </li>
            </ul>
          </section>

          <section>
            <h2>Dostępność architektoniczna</h2>
            <p>
              Informacje o dostępności budynku urzędu (wejścia, windy, toalety, miejsca parkingowe, pętle indukcyjne, tłumacz polskiego języka
              migowego) podaje urząd, który wdraża aplikację.
            </p>
          </section>

          <section>
            <h2>Aplikacje mobilne</h2>
            <p>Kompas Kompetencji nie ma aplikacji mobilnej. Aplikacja internetowa działa w przeglądarce na telefonie i tablecie.</p>
          </section>
        </article>
      </main>

      <footer className="border-t bg-card print:hidden">
        <div className="mx-auto max-w-4xl px-4 py-4 text-sm text-muted-foreground md:px-6">
          <Link href="/">Wróć do aplikacji</Link>
        </div>
      </footer>
    </div>
  );
}
