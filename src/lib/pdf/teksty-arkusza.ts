// Stałe teksty arkuszy B i C – dosłownie z wzorów (załączniki nr 3 i 4 do rozporządzenia PRM z 4.04.2016, Dz.U. poz. 470;
// pliki w materialy/ocena-okresowa/). Numery przypisów jak we wzorze.

export const ROZPORZADZENIE =
  "rozporządzenia Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej";

export const NAGLOWEK = {
  B: { zalacznik: "Załącznik nr 3", tytul: "ARKUSZ B" },
  C: { zalacznik: "Załącznik nr 4", tytul: "ARKUSZ C" },
} as const;

export const POTWIERDZENIE_CZESCI_I = [
  `przeprowadzenie rozmowy, o której mowa w § 5 ust. 1 ${ROZPORZADZENIE} (Dz. U. poz. 470), i omówienie w trakcie tej rozmowy wszystkich wymaganych zagadnień`,
  "zapoznanie ocenianego z kryteriami oceny oraz terminem sporządzenia oceny.",
];

export const ZAPOZNANIE_Z_OCENA =
  "Przeprowadzono ze mną rozmowę oceniającą oraz zapoznałem(-łam) się z oceną okresową i wnioskami dotyczącymi indywidualnego programu rozwoju zawodowego.";

export const POUCZENIE =
  "Zgodnie z art. 83 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej od oceny okresowej służy, w terminie 7 dni od dnia zapoznania się z oceną, sprzeciw do dyrektora generalnego urzędu";

export const WSTEP_CZESCI_III =
  "Wniosek jest wypełniany i dołączany do arkusza oceny okresowej ocenianego tylko w sytuacji skorzystania przez oceniającego z możliwości przewidzianej w art. 89 ust. 1 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej.";

const KRYTERIA_Z_ZALACZNIKA = `Należy wpisać nazwy wybranych kryteriów, korzystając z załącznika nr 1 do ${ROZPORZADZENIE}.`;

/** Przypisy 1–18 (przypis 1 różni się dla arkuszy B i C). */
export function przypisy(arkusz: "B" | "C"): Record<number, string> {
  return {
    1:
      arkusz === "B"
        ? "Arkusz służy do sporządzenia oceny okresowej urzędnika służby cywilnej lub pracownika służby cywilnej, zatrudnionego na stanowisku, na którym praca polega na bezpośrednim kierowaniu pracownikami."
        : "Arkusz służy do sporządzenia oceny okresowej urzędnika służby cywilnej lub pracownika służby cywilnej, zatrudnionego na stanowisku, które nie jest: – stanowiskiem kierownika urzędu, będącym stanowiskiem pracy w służbie cywilnej, ani – stanowiskiem, na którym praca polega na bezpośrednim kierowaniu pracownikami.",
    2: "Należy wskazać pełną nazwę stanowiska pracy wraz z jego rozszerzeniem określającym, do jakich spraw jest to stanowisko (jeżeli zostało to określone w opisie stanowiska pracy).",
    3: KRYTERIA_Z_ZALACZNIKA,
    4: "W trakcie rozmowy omawiane są: 1) główne obowiązki wynikające z opisu stanowiska pracy zajmowanego przez ocenianego, 2) kryteria obowiązkowe i kryteria dodatkowe, jeżeli są wybierane przez oceniającego, 3) oczekiwania oceniającego co do sposobu spełniania kryteriów oceny przez ocenianego, 4) cele do osiągnięcia w okresie, w którym oceniany podlega ocenie, jeżeli ich określenie jest uzasadnione ze względu na charakter obowiązków wynikających z opisu stanowiska pracy zajmowanego przez ocenianego, a także sposób realizacji wyznaczonych celów.",
    5: "W trakcie rozmowy oceniającej omawia się: 1) główne obowiązki wykonywane przez ocenianego w okresie, w którym podlegał ocenie, oraz sposób ich realizacji, z uwzględnieniem spełniania przez ocenianego ustalonych kryteriów oceny, 2) sposób realizowania przez ocenianego celów do osiągnięcia w okresie, w którym oceniany podlegał ocenie, jeżeli cele te zostały wyznaczone, 3) kierunki dalszego rozwoju zawodowego i potrzeby ocenianego w zakresie podnoszenia kwalifikacji i doskonalenia umiejętności.",
    6: "Data „od” oznacza datę zapoznania ocenianego z kryteriami oceny – z części I arkusza oceny.",
    7: "Data „do” oznacza datę sporządzenia oceny na piśmie. Jeżeli ocena okresowa jest sporządzana w związku z zastosowaniem art. 81 ust. 6 ustawy z dnia 21 listopada 2008 r. o służbie cywilnej (Dz. U. z 2014 r. poz. 1111, z późn. zm.) i nie została sporządzona przed zmianą stanowiska pracy, należy w tym polu wpisać ostatni dzień pracy na zajmowanym stanowisku pracy.",
    8: "Należy wstawić znak „X” w odpowiednie pole.",
    9: KRYTERIA_Z_ZALACZNIKA,
    10: "POZYTYWNA – w przypadku ustalenia ogólnego poziomu spełniania kryteriów oceny na poziomie „znacznie powyżej oczekiwań”, „powyżej oczekiwań” albo „na poziomie oczekiwań”, pod warunkiem nieuzyskania przez ocenianego żadnej z ocen cząstkowych na poziomie „znacznie poniżej oczekiwań”.",
    11: "NEGATYWNA – w przypadku ustalenia ogólnego poziomu spełniania kryteriów oceny na poziomie „poniżej oczekiwań” albo „znacznie poniżej oczekiwań”, a także w przypadku uzyskania przez ocenianego co najmniej jednej oceny cząstkowej na poziomie „znacznie poniżej oczekiwań”.",
    12: "Uzasadnienie jest obligatoryjne w przypadku otrzymania przez ocenianego negatywnej oceny okresowej. W przypadku przyznania oceny pozytywnej uzasadnienie jest fakultatywne. Sporządzenie uzasadnienia oceny może polegać na ogólnym omówieniu oceny lub na szczegółowym odniesieniu się do wszystkich ocen cząstkowych albo tylko do niektórych z nich.",
    13: "Uwzględniając sporządzoną ocenę, realizowane i przyszłe zadania oraz oczekiwania ocenianego, należy określić kierunki rozwoju zawodowego ocenianego, biorąc pod uwagę obszary wiedzy i umiejętności wymagające doskonalenia, oraz zaproponować optymalne formy i metody ich realizacji.",
    14: "Należy wpisać „pozytywna” lub „negatywna”.",
    15: "Należy wpisać, na jakim poziomie była przyznana poprzednia ocena okresowa (np. „na poziomie oczekiwań”).",
    16: "Należy wstawić znak „X” w odpowiednie pole.",
    17: "W urzędzie, w którym przepisy nie przewidują tworzenia stanowiska dyrektora generalnego urzędu, sprzeciw składa się do kierownika tego urzędu.",
    18: "Części III nie drukuje się i nie dołącza do arkusza oceny okresowej w przypadku ocenianego będącego pracownikiem służby cywilnej oraz w razie nieskładania wniosku o przyznanie urzędnikowi służby cywilnej kolejnego stopnia służbowego.",
  };
}

/** Przypisy wg części arkusza (które numery drukujemy pod daną częścią). */
export const PRZYPISY_CZESCI = {
  I: [1, 2, 3, 4],
  II: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
  III: [18],
} as const;
