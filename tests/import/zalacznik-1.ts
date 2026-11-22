// Wskaźniki behawioralne dosłownie z załącznika nr 1 do rozporządzenia PRM z 4.04.2016 (Dz.U. poz. 470),
// „Wykaz kryteriów oceny”, s. 5–7 pliku materialy/ocena-okresowa/Rozporzadzenie_oceny_okresowe_2016_wariant-a.pdf.
// Niezależne źródło prawdy dla testu importu modelu kompetencji: nazwy w xlsx muszą być z nim identyczne.

import type { CompetencyCode } from "@/lib/domain/types";

export const ZALACZNIK_1: Record<CompetencyCode, string[]> = {
  RZETELNOSC: [
    "Wykonywanie zadań zgodnie z obowiązującymi standardami (przepisami, zasadami, procedurami) oraz dbałość o jakość rezultatów.",
    "Dotrzymywanie zobowiązań (realizacja zadań) w wyznaczonym czasie.",
  ],
  KOMUNIKACJA: [
    "Koncentrowanie się na wypowiedzi rozmówcy i dbanie o wzajemne zrozumienie.",
    "Wypowiadanie się w sposób jasny i precyzyjny, dostosowany do sytuacji i rozmówcy (dobieranie stylu, języka i treści).",
    "Formułowanie jasnych i precyzyjnych wypowiedzi pisemnych dostosowanych do sytuacji i odbiorcy (dobieranie stylu, języka i treści).",
    "Przedstawianie przekonujących argumentów odpowiednio do sytuacji.",
  ],
  WIEDZA: [
    "Wykorzystywanie wiedzy przy realizacji zadań na zajmowanym stanowisku pracy.",
    "Doskonalenie wiedzy i umiejętności niezbędnych do wykonywania zadań na zajmowanym stanowisku pracy, w szczególności wyszukiwanie i pozyskiwanie wiedzy, korzystanie z dobrych praktyk i doświadczeń innych.",
    "Korzystanie z dostępnych źródeł informacji, rozwiązań i technologii.",
  ],
  ORGANIZACJA: [
    "Określanie sposobu realizacji zadań/celów.",
    "Realizowanie zadań/celów w kolejności uwzględniającej ich wagę i pilność (ustalanie priorytetów działania).",
    "Dobieranie niezbędnych zasobów umożliwiających realizację zadań/celów.",
    "Dostosowywanie się do zmieniających się okoliczności.",
    "Wytrwałość i zaangażowanie w realizację zadań/celów.",
  ],
  KREATYWNOSC: [
    "Proponowanie lub tworzenie nowych rozwiązań.",
    "Nieschematyczne podejście do zadań.",
  ],
  WSPOLPRACA: [
    "Włączanie się w działania realizowane razem z innymi osobami, jeśli istnieje taka możliwość.",
    "Dbanie o przepływ informacji.",
    "Dbanie o dobrą atmosferę i otwartość we współpracy.",
    "Dostrzeganie wkładu pracy innych osób.",
    "Branie pod uwagę zdania innych osób.",
    "Dzielenie się wiedzą i doświadczeniem.",
  ],
  ANALITYCZNE: [
    "Rozróżnianie informacji istotnych i nieistotnych.",
    "Dostrzeganie zależności między informacjami.",
    "Formułowanie wniosków.",
  ],
  NEGOCJOWANIE: [
    "Przygotowywanie się do negocjacji, w szczególności opracowanie projektu stanowiska, zakresu możliwych ustępstw i argumentacji.",
    "Stosowanie technik i strategii negocjacyjnych.",
    "Osiągnięcie efektu negocjacji akceptowanego przez przełożonych.",
  ],
  WYSTAPIENIA: [
    "Wykorzystywanie różnych środków przekazu (np. narzędzi multimedialnych) i dbałość o sposób prezentacji (w tym autoprezentacji).",
    "Nawiązywanie i utrzymywanie kontaktu z audytorium.",
    "Zarządzanie czasem wystąpienia, w szczególności przestrzeganie ram czasowych, elastyczne reagowanie na potrzeby audytorium.",
    "Radzenie sobie ze stresem i emocjami, w szczególności wywołanymi krytyką i trudnymi pytaniami.",
  ],
  KLIENT: [
    "Taktowne zachowanie, wyrażające szacunek i zrozumienie dla drugiej osoby.",
    "Reagowanie na potrzeby klienta/interesanta, w szczególności rozpoznawanie jego potrzeb i proponowanie rozwiązań.",
  ],
  KRYZYS: [
    "Rozpoznawanie sytuacji kryzysowych i informowanie o nich zainteresowanych.",
    "Podejmowanie działań mających na celu rozwiązanie kryzysu.",
    "Wyciąganie wniosków z sytuacji kryzysowych.",
  ],
  STRATEGICZNE: [
    "Tworzenie wizji oraz wyznaczanie celów strategicznych w oparciu o całościowe i perspektywiczne widzenie organizacji, otoczenia oraz strategie rozwoju.",
    "Formułowanie celów operacyjnych na podstawie celów strategicznych.",
    "Analiza ryzyka planowanych działań o charakterze strategicznym.",
  ],
  LUDZIE: [
    "Przydzielanie zakresu odpowiedzialności, zadań i uprawnień pracownikom (delegowanie zadań).",
    "Monitorowanie realizacji zadań oraz w razie potrzeby podejmowanie działań korygujących lub zapobiegawczych.",
    "Motywowanie pracowników.",
    "Udzielanie pracownikom informacji zwrotnej opartej na ocenie ich zaangażowania i sposobu realizacji zadań.",
    "Rozwiązywanie konfliktów.",
    "Wspieranie pracowników w rozwoju zawodowym, w szczególności identyfikowanie potrzeb rozwojowych, proponowanie działań rozwojowych oraz monitorowanie ich realizacji.",
  ],
  DECYZJE: [
    "Wypracowywanie alternatywnych rozwiązań na podstawie analizy informacji, w szczególności potencjalnego ryzyka.",
    "Podejmowanie decyzji (decyzyjność).",
    "Przyjmowanie odpowiedzialności za efekty podjętych decyzji.",
  ],
};
