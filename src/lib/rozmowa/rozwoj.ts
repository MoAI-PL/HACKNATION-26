// Propozycje działań rozwojowych do rozmowy (Z24) – po 3 na kompetencję z modelu.
// ZAŁOŻENIE: katalog przygotowany przez zespół na podstawie typowych form rozwoju w administracji
// (mentoring, coaching, szkolenia, zadania rozwojowe). Przełożony wybiera i dopasowuje – to podpowiedź, nie zalecenie.

import type { CompetencyCode } from "@/lib/domain/types";

export const DEVELOPMENT_IDEAS: Record<CompetencyCode, string[]> = {
  RZETELNOSC: [
    "Lista kontrolna do najczęstszych spraw i jej wspólny przegląd po miesiącu",
    "Krótkie przeglądy postępu w połowie terminu dłuższych zadań",
    "Szkolenie z zarządzania czasem i planowania pracy",
  ],
  KOMUNIKACJA: [
    "Szkolenie z prostego języka urzędowego i redagowania pism",
    "Informacja zwrotna od przełożonego do 2–3 pism przed wysyłką",
    "Prowadzenie krótkiego omówienia sprawy na spotkaniu zespołu",
  ],
  WIEDZA: [
    "Udział w szkoleniu z przepisów kluczowych dla stanowiska (z OSP)",
    "Przygotowanie krótkiego materiału dla zespołu o zmianach w przepisach",
    "Mentoring u osoby z większym doświadczeniem w danym obszarze",
  ],
  ORGANIZACJA: [
    "Planowanie tygodnia z ustaleniem priorytetów i wspólny przegląd raz w tygodniu",
    "Prowadzenie harmonogramu jednego wieloetapowego zadania",
    "Szkolenie z zarządzania zadaniami i priorytetami",
  ],
  KREATYWNOSC: [
    "Zadanie rozwojowe: propozycja usprawnienia jednej procedury w wydziale",
    "Udział w warsztacie z projektowania usług (design thinking)",
    "Przegląd dobrych praktyk z innych urzędów i omówienie ich w zespole",
  ],
  WSPOLPRACA: [
    "Udział w zespole projektowym z inną komórką",
    "Wymiana doświadczeń (job shadowing) w komórce współpracującej",
    "Prowadzenie krótkiego przekazania wiedzy dla nowej osoby",
  ],
  ANALITYCZNE: [
    "Szkolenie z analizy danych i formułowania wniosków",
    "Przygotowanie analizy jednego problemu z rekomendacjami i omówienie jej z przełożonym",
    "Mentoring w przygotowywaniu opinii i analiz",
  ],
  NEGOCJOWANIE: [
    "Szkolenie z technik negocjacyjnych",
    "Udział w negocjacjach w roli obserwatora, a potem współprowadzącego",
    "Przygotowanie stanowiska negocjacyjnego z wariantami ustępstw przed ważnym spotkaniem",
  ],
  WYSTAPIENIA: [
    "Szkolenie z wystąpień publicznych i autoprezentacji",
    "Prowadzenie prezentacji na spotkaniu wewnętrznym z informacją zwrotną",
    "Próba wystąpienia z nagraniem i wspólnym omówieniem",
  ],
  KLIENT: [
    "Szkolenie z obsługi klienta i komunikacji w trudnych sytuacjach",
    "Analiza zgłoszeń lub skarg interesantów i propozycja usprawnień",
    "Wspólne prowadzenie trudnej rozmowy z interesantem z doświadczoną osobą",
  ],
  KRYZYS: [
    "Udział w ćwiczeniach zarządzania kryzysowego",
    "Szkolenie z reagowania na incydenty i komunikacji kryzysowej",
    "Omówienie ostatniej sytuacji kryzysowej i spisanie wniosków na przyszłość",
  ],
  STRATEGICZNE: [
    "Udział w pracach nad dokumentem strategicznym komórki",
    "Coaching z myślenia strategicznego i planowania długookresowego",
    "Przygotowanie analizy ryzyka planowanego przedsięwzięcia",
  ],
  LUDZIE: [
    "Szkolenie z udzielania informacji zwrotnej i rozmów rozwojowych",
    "Coaching dla kierujących zespołem",
    "Regularne rozmowy 1:1 z członkami zespołu z krótkimi notatkami",
  ],
  DECYZJE: [
    "Przygotowywanie wariantów rozstrzygnięć z analizą ryzyka przed decyzją",
    "Mentoring u osoby podejmującej decyzje w podobnym obszarze",
    "Szkolenie z podejmowania decyzji i zarządzania ryzykiem",
  ],
};
