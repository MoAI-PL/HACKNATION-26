// Stałe teksty arkusza pierwszej oceny – dosłownie ze wzoru (załącznik nr 2 do rozporządzenia PRM z 23.07.2015,
// Dz.U. poz. 1144; plik materialy/pierwsza-ocena/Arkusz_pierwszej_oceny.docx). Numery przypisów jak we wzorze.

export const TYTUL_PIERWSZEJ = "ARKUSZ PIERWSZEJ OCENY W SŁUŻBIE CYWILNEJ";

export const POTWIERDZENIE_WSTEPNEJ =
  "Potwierdzamy przeprowadzenie rozmowy wstępnej oraz wyznaczenie terminu na złożenie sprawozdania i zapoznanie z nim ocenianego.";

export const POTWIERDZENIE_OCENIAJACEJ =
  "Potwierdzamy przeprowadzenie rozmowy oceniającej i omówienie w trakcie tej rozmowy wszystkich wymaganych zagadnień";

export const NAGLOWEK_ELEMENTOW =
  "OCENA POSTAWY OCENIANEGO, JEGO ZAANGAŻOWANIA I POSTĘPÓW W PRACY, RELACJI ZE WSPÓŁPRACOWNIKAMI ORAZ TERMINOWOŚCI WYKONYWANIA ZADAŃ";

export const ZAPOZNANIE_PIERWSZA = "Zapoznałam(-łem) się z pierwszą oceną w służbie cywilnej.";

export const PRZYPISY_PIERWSZEJ: Record<number, string> = {
  1: "W przypadku ocenianego zatrudnionego w celu zastępstwa nieobecnego członka korpusu służby cywilnej – data ustalenia przez strony stosunku pracy, że oceniany będzie podlegać pierwszej ocenie.",
  2: "W trakcie rozmowy oceniającej omawiane są: 1) postawa ocenianego, jego zaangażowanie i postępy w pracy, relacje ze współpracownikami oraz terminowość wykonywania zadań, oceniane za pomocą elementów oceny, 2) wynik egzaminu ze służby przygotowawczej, jeżeli oceniany był obowiązany do przystąpienia do tego egzaminu, 3) sprawozdanie sporządzone przez ocenianego. Można również omówić kierunki dalszego rozwoju zawodowego i potrzeby ocenianego.",
  3: "Opisy elementów oceny są określone w załączniku nr 1 do rozporządzenia Prezesa Rady Ministrów z dnia 23 lipca 2015 r. w sprawie szczegółowych warunków i sposobu dokonywania pierwszej oceny w służbie cywilnej (Dz. U. poz. 1144).",
  4: "Ocena łączna jest średnią arytmetyczną ze wszystkich ocen cząstkowych.",
  5: "Nie dotyczy ocenianego będącego: 1) absolwentem Krajowej Szkoły Administracji Publicznej, który nie złożył wniosku o mianowanie w służbie cywilnej, 2) pracownikiem służby cywilnej zatrudnionym w celu zastępstwa nieobecnego członka korpusu służby cywilnej, podlegającym pierwszej ocenie, 3) pracownikiem służby cywilnej zatrudnionym na wyższym stanowisku w służbie cywilnej.",
  6: "Pozytywną pierwszą ocenę należy przyznać ocenianemu, który łącznie spełnił następujące warunki: 1) zaliczył egzamin ze służby przygotowawczej, chyba że nie dotyczył go obowiązek przystąpienia do tego egzaminu, 2) złożył sprawozdanie w wyznaczonym terminie, 3) uzyskał nie więcej niż jedną ocenę cząstkową w wysokości 3 punktów za postawę ocenianego, jego zaangażowanie i postępy w pracy, relacje ze współpracownikami oraz terminowość wykonywania zadań, 4) uzyskał ocenę łączną nie niższą niż 5 punktów za postawę ocenianego, jego zaangażowanie i postępy w pracy, relacje ze współpracownikami oraz terminowość wykonywania zadań.",
  7: "W przypadku przyznania negatywnej pierwszej oceny uzasadnienie przyznanej oceny jest obowiązkowe, a w przypadku przyznania pozytywnej pierwszej oceny – fakultatywne. Uzasadnienie przyznanej oceny może polegać na ogólnym omówieniu oceny lub na szczegółowym odniesieniu się do wszystkich ocen cząstkowych albo tylko do niektórych z nich.",
  8: "Wnioski dotyczące rozwoju zawodowego ocenianego sporządza się fakultatywnie – tylko w przypadku przyznania pozytywnej pierwszej oceny. Określa się m.in. zakres wiedzy, która powinna być poszerzona, zakres umiejętności, które wymagają doskonalenia, oraz proponowane formy rozwoju zawodowego ocenianego.",
};

/** Kolumny ocen cząstkowych pierwszej oceny (§ 9 ust. 1). */
export const KOLUMNY_PIERWSZEJ = [
  { points: 3, label: "poniżej oczekiwań", unit: "3 punkty" },
  { points: 5, label: "na poziomie oczekiwań", unit: "5 punktów" },
  { points: 7, label: "powyżej oczekiwań", unit: "7 punktów" },
] as const;
