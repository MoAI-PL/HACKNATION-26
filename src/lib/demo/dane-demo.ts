// Dane demo wokół persony przełożonej (Z26). Wszystkie osoby i zdarzenia są fikcyjne;
// opisy stanowisk pochodzą z materiałów MC (materialy/OSP → prisma/seed-dane/osp.json).
//
// Daty liczymy względem dnia uruchomienia (`today`), więc karta „Do zrobienia” zawsze pokazuje aktualne terminy.
// Terminy liczy silnik Z08, a wyniki poprzednich ocen silnik Z07 – dane są spójne z przepisami.
//
// ZAŁOŻENIE: dla jednego konta demo Ewa Kowalczyk jest bezpośrednią przełożoną wszystkich sześciu osób,
// choć w OSP stanowiska podlegają różnym przełożonym (uproszczenie demo, opisane w docs/ZALOZENIA.md).
//
// Użycie: seedDemoData(prisma) – usuwa poprzednie dane demo (poza kontami) i tworzy je od nowa. Z44 (reset demo) woła to samo.

import type { Prisma, PrismaClient } from "@prisma/client";
import ospData from "../../../prisma/seed-dane/osp.json";
import { DEMO_ACCOUNTS } from "@/lib/auth/demo";
import { fromDbDate, toDbDate, todayIso } from "@/lib/domain/daty";
import type { CompetencyCode, IsoDate, PartialScore, PeriodicPoints, PositionDescription } from "@/lib/domain/types";
import { addDays, addMonths } from "@/lib/rules/kalendarz";
import { mandatoryCriteria } from "@/lib/rules/kryteria";
import { scorePeriodic } from "@/lib/rules/punktacja";
import {
  afterNegativeDeadlines,
  criteriaConversationDeadline,
  firstEvalWindow,
  initialConversationDeadline,
  periodicEvaluationDeadline,
  type AbsencePeriod,
} from "@/lib/rules/terminy";

type OspKey = "NACZELNIK" | "RADCA" | "STARSZY_SPECJALISTA";
type OspEntry = PositionDescription & { symbol: string; sourceFileName: string; rawText: string };
export const DEMO_OSP = ospData as Record<OspKey, OspEntry>;

/** Obserwacja: [ile dni temu, wskaźnik, poziom zachowania 1–5, sytuacja, działanie, rezultat]. */
type Obs = [number, `${CompetencyCode}.${number}`, 1 | 2 | 3 | 4 | 5, string, string, string];

// ---------------------------------------------------------------------------
// Obserwacje (Sytuacja – Działanie – Rezultat)
// ---------------------------------------------------------------------------

const OBS_KATARZYNA: Obs[] = [
  [640, "WIEDZA.1", 4, "Pierwsza opinia indywidualna dotycząca stosowania przepisów o sztucznej inteligencji.", "Oparła opinię na wytycznych organów unijnych i dwóch orzeczeniach, wskazała ryzyka interpretacyjne.", "Opinia przyjęta bez poprawek przez naczelnika i Komisję."],
  [560, "KOMUNIKACJA.3", 4, "Projekt odpowiedzi na pismo przedsiębiorcy w sprawie klasyfikacji systemu AI.", "Napisała odpowiedź prostym językiem, z krótkim streszczeniem na początku.", "Wnioskodawca nie dopytywał; wzór odpowiedzi trafił do szablonów wydziału."],
  [470, "RZETELNOSC.2", 3, "Kwartalny przegląd orzecznictwa.", "Przekazała przegląd w terminie, kompletny.", "Materiał wykorzystany na posiedzeniu Komisji."],
  [400, "WSPOLPRACA.2", 4, "Zmiana wytycznych unijnych w trakcie przygotowania stanowiska.", "Od razu poinformowała zespół i departament prawny, rozesłała porównanie zmian.", "Dwa wydziały zdążyły zaktualizować swoje materiały przed terminem."],
  [330, "ANALITYCZNE.3", 5, "Analiza barier prawnych dla piaskownic regulacyjnych AI.", "Zestawiła bariery w trzech grupach i dla każdej zaproponowała zmianę przepisu.", "Dwie propozycje weszły do projektu założeń ustawy."],
  [250, "KOMUNIKACJA.2", 4, "Prezentacja wyników analizy na spotkaniu z izbami gospodarczymi.", "Dostosowała język do odbiorców spoza administracji, odpowiadała na pytania na przykładach.", "Uczestnicy ocenili spotkanie jako najbardziej zrozumiałe z cyklu."],
  [190, "ORGANIZACJA.2", 3, "Trzy pilne opinie w jednym tygodniu.", "Ustaliła z naczelnikiem kolejność według terminów ustawowych.", "Wszystkie opinie oddane w terminie, jedna z drobnymi poprawkami."],
  [120, "KREATYWNOSC.1", 4, "Rosnąca liczba podobnych zapytań od przedsiębiorców.", "Zaproponowała zestaw najczęstszych pytań i odpowiedzi publikowany na stronie.", "Liczba powtarzalnych zapytań spadła w kolejnym kwartale."],
  [60, "WSPOLPRACA.6", 4, "Nowa osoba w wydziale bez doświadczenia w prawie UE.", "Przygotowała dla niej krótką ścieżkę wdrożenia i omówiła dwie pierwsze sprawy.", "Nowa osoba samodzielnie przygotowała projekt opinii po miesiącu."],
  [20, "KOMUNIKACJA.4", 3, "Spór z innym departamentem o interpretację przepisu.", "Przedstawiła argumenty na piśmie, ale nie przekonała drugiej strony.", "Sprawa przekazana do rozstrzygnięcia przez dyrektora."],
];

const OBS_PIOTR: Obs[] = [
  [620, "LUDZIE.1", 4, "Reorganizacja zadań po odejściu dwóch osób z wydziału.", "Rozdzielił zadania według kompetencji i jasno określił odpowiedzialność za każdą sprawę.", "Wydział utrzymał terminy mimo mniejszej obsady."],
  [520, "DECYZJE.2", 3, "Wybór wykonawcy tłumaczeń na szczyt cyfrowy.", "Podjął decyzję po analizie dwóch ofert, w wyznaczonym terminie.", "Usługa zrealizowana zgodnie z umową."],
  [430, "WYSTAPIENIA.2", 5, "Otwarcie międzynarodowej konferencji w zastępstwie dyrektora.", "Wystąpił bez przygotowanego wcześniej tekstu, nawiązał do pytań z sali.", "Organizator poprosił o udział w kolejnej edycji."],
  [330, "LUDZIE.4", 2, "Błędy w rozliczeniu dotacji przygotowanym przez pracownika.", "Poprawił dokument sam, nie omawiając błędów z pracownikiem.", "Podobne błędy powtórzyły się w następnym rozliczeniu."],
  [210, "ORGANIZACJA.4", 4, "Przesunięcie wizyty delegacji zagranicznej o tydzień.", "W ciągu jednego dnia przebudował plan wizyty i rezerwacje.", "Wizyta odbyła się bez kosztów dodatkowych."],
  [120, "LUDZIE.5", 4, "Konflikt dwóch pracowników o podział obsługi delegacji.", "Przeprowadził rozmowę z obiema osobami i ustalił zasady rotacji.", "Konflikt nie powrócił, zasady stosowane w całym wydziale."],
  [40, "NEGOCJOWANIE.3", 4, "Renegocjacja warunków umowy na bilety lotnicze.", "Przygotował stanowisko z wariantami ustępstw i uzgodnił je z dyrektorem.", "Uzyskał niższe opłaty serwisowe akceptowane przez kierownictwo."],
];

const OBS_JAN: Obs[] = [
  [520, "KRYZYS.1", 3, "Ćwiczenie zarządzania kryzysowego w cyberprzestrzeni.", "Zgłosił zidentyfikowany incydent zgodnie z procedurą.", "Ćwiczenie zaliczone bez uwag."],
  [300, "RZETELNOSC.1", 3, "Aktualizacja wykazu obiektów infrastruktury krytycznej.", "Uzupełnił wykaz według wytycznych.", "Wykaz przekazany w terminie."],
  [28, "KOMUNIKACJA.3", 4, "Raport po kontroli podmiotu krytycznego.", "Napisał raport z jasnymi zaleceniami i terminami.", "Podmiot wdrożył zalecenia bez dodatkowych wyjaśnień."],
  [24, "WSPOLPRACA.2", 4, "Wspólne ćwiczenie z zespołem CSIRT.", "Na bieżąco przekazywał informacje między zespołami.", "Czas reakcji w ćwiczeniu krótszy niż w poprzedniej edycji."],
  [19, "ORGANIZACJA.1", 3, "Przygotowanie kontroli w dwóch podmiotach w jednym miesiącu.", "Rozpisał harmonogram i listę dokumentów do sprawdzenia.", "Obie kontrole przeprowadzone w terminie."],
  [14, "KRYZYS.2", 4, "Zgłoszenie incydentu w podmiocie krytycznym w nocy (dyżur).", "Uruchomił procedurę i powiadomił właściwe zespoły.", "Incydent opanowany w ciągu kilku godzin."],
  [9, "WIEDZA.2", 4, "Nowe przepisy dotyczące odporności podmiotów krytycznych.", "Z własnej inicjatywy ukończył szkolenie i podzielił się notatką z wydziałem.", "Notatka stała się materiałem pomocniczym przy kontrolach."],
  [3, "ANALITYCZNE.2", 3, "Ocena nowego obiektu pod kątem infrastruktury krytycznej.", "Powiązał dane z dwóch rejestrów i przygotował rekomendację.", "Rekomendacja w trakcie uzgodnień."],
];

const OBS_MARCIN: Obs[] = [
  [30, "RZETELNOSC.2", 3, "Pierwsze zadanie po ocenie negatywnej – aktualizacja procedury.", "Oddał dokument w uzgodnionym terminie.", "Dokument przyjęty z drobnymi poprawkami."],
  [22, "KOMUNIKACJA.1", 3, "Spotkanie z zespołem CSIRT.", "Dopytywał o niejasne kwestie i podsumował ustalenia mailem.", "Ustalenia zrealizowane bez nieporozumień."],
  [15, "RZETELNOSC.1", 2, "Przygotowanie dokumentacji do kontroli.", "Pominął dwa wymagane załączniki z listy kontrolnej.", "Kontrola przesunięta o dwa dni."],
  [8, "ORGANIZACJA.2", 3, "Kilka zadań z terminem w tym samym tygodniu.", "Ustalił z przełożoną kolejność i trzymał się jej.", "Wszystkie zadania zakończone w terminie."],
  [2, "WIEDZA.1", 4, "Pytanie od podmiotu krytycznego o nowe obowiązki.", "Odpowiedział samodzielnie, powołując się na właściwe przepisy.", "Podmiot nie kierował dalszych pytań."],
];

const OBS_ALEKSANDRA: Obs[] = [
  [8, "WSPOLPRACA.1", 4, "Przygotowanie materiałów na posiedzenie zespołu.", "Sama zgłosiła się do pomocy przy zestawieniu danych.", "Materiały gotowe dzień przed terminem."],
  [3, "WIEDZA.3", 3, "Pierwsza analiza zgłoszenia incydentu.", "Skorzystała z bazy wiedzy wydziału i wzorów dokumentów.", "Analiza poprawna, z drobnymi uzupełnieniami."],
];

/** Obserwacje demo według osoby (do testów spójności). */
export const DEMO_OBSERVATIONS = {
  KATARZYNA: OBS_KATARZYNA,
  PIOTR: OBS_PIOTR,
  JAN: OBS_JAN,
  MARCIN: OBS_MARCIN,
  ALEKSANDRA: OBS_ALEKSANDRA,
} as const;

// ---------------------------------------------------------------------------

export interface DemoSummary {
  today: IsoDate;
  employees: number;
  evaluations: number;
  observations: number;
}

const SALUTE = "Ministerstwo Cyfryzacji (dane demo)";

/** Usuwa dane demo (pracownicy, stanowiska, komórki, oceny, przypomnienia) – konta użytkowników zostają. */
export async function clearDemoData(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction([
    prisma.user.updateMany({ data: { employeeId: null } }),
    prisma.reminder.deleteMany({}),
    prisma.auditLog.deleteMany({ where: { NOT: { action: "LOGOWANIE" } } }),
    prisma.employee.deleteMany({}), // kaskadowo: oceny, kryteria, oceny wskaźników, obserwacje, rozmowy, nieobecności, zmiany stanowiska
    prisma.position.deleteMany({}),
    prisma.orgUnit.deleteMany({}),
  ]);
}

function periodicScores(codes: CompetencyCode[], points: PeriodicPoints[]): PartialScore[] {
  return codes.map((competency, i) => ({ competency, kind: i < 5 ? "OBOWIAZKOWE" : "DODATKOWE", points: points[i]! }));
}

/** Tworzy pełny zestaw danych demo. Wymaga kont z DEMO_ACCOUNTS (prisma/seed.ts tworzy je wcześniej). */
export async function seedDemoData(prisma: PrismaClient, today: IsoDate = todayIso()): Promise<DemoSummary> {
  const d = (offsetDays: number) => addDays(today, offsetDays);
  const db = (iso: IsoDate) => toDbDate(iso);

  const users = await prisma.user.findMany({ where: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } } });
  const byRole = (role: string) => {
    const u = users.find((x) => x.role === role);
    if (!u) throw new Error(`Brak konta demo z rolą ${role} – uruchom najpierw tworzenie kont (prisma/seed.ts).`);
    return u;
  };
  const ewa = byRole("PRZELOZONY");
  const kierujacy = byRole("KIERUJACY_KOMORKA");
  const janUser = byRole("OCENIANY");

  await clearDemoData(prisma);

  // --- komórki i stanowiska z OSP --------------------------------------------
  const ministerstwo = await prisma.orgUnit.create({ data: { name: SALUTE, shortName: "MC" } });
  const positions = {} as Record<OspKey, { id: string; orgUnitId: string }>;
  for (const key of Object.keys(DEMO_OSP) as OspKey[]) {
    const o = DEMO_OSP[key];
    const [dept, ...wydzial] = splitUnit(o.orgUnit ?? "");
    const deptUnit = await prisma.orgUnit.create({ data: { name: dept, shortName: o.symbol.split(" ")[0], parentId: ministerstwo.id } });
    const unit = await prisma.orgUnit.create({ data: { name: wydzial.join(" ") || dept, shortName: o.symbol.split(" ").slice(0, 2).join(" "), parentId: deptUnit.id } });
    const p = await prisma.position.create({
      data: {
        title: o.title,
        orgUnitId: unit.id,
        purpose: o.purpose,
        dominantTasks: o.dominantTasks,
        otherTasks: o.otherTasks,
        subordinates: o.subordinates,
        authorizations: o.authorizations,
        requiredCompetencies: o.requiredCompetencies,
        rawText: o.rawText,
        sourceFileName: o.sourceFileName,
      },
    });
    positions[key] = { id: p.id, orgUnitId: unit.id };
  }

  const employee = (data: {
    firstName: string;
    lastName: string;
    osp: OspKey;
    employmentStart: IsoDate;
    permanentFrom?: IsoDate;
    contractEnd?: IsoDate;
    isCivilServant?: boolean;
    appointmentYear?: number;
    serviceGrade?: number;
    unitHead?: boolean;
  }) =>
    prisma.employee.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        employmentStart: db(data.employmentStart),
        permanentFrom: data.permanentFrom ? db(data.permanentFrom) : null,
        contractEnd: data.contractEnd ? db(data.contractEnd) : null,
        isCivilServant: data.isCivilServant ?? false,
        appointmentYear: data.appointmentYear,
        serviceGrade: data.serviceGrade,
        orgUnitId: positions[data.osp].orgUnitId,
        positionId: positions[data.osp].id,
        supervisorId: ewa.id,
        unitHeadId: data.unitHead ? kierujacy.id : null,
      },
    });

  const addObservations = (employeeId: string, list: Obs[]) =>
    prisma.observation.createMany({
      data: list.map(([ago, indicatorId, level, situation, action, outcome]) => ({
        employeeId,
        authorId: ewa.id,
        date: db(d(-ago)),
        competency: indicatorId.split(".")[0] as CompetencyCode,
        indicatorId,
        behaviorLevel: level,
        situation,
        action,
        outcome,
        source: "RECZNA" as const,
      })),
    });

  /** Zakończona ocena okresowa z wynikiem policzonym silnikiem Z07. */
  const pastPeriodic = async (employeeId: string, sheet: "B" | "C", evaluatedAt: IsoDate, codes: CompetencyCode[], points: PeriodicPoints[], justification?: string) => {
    const s = scorePeriodic(periodicScores(codes, points));
    await prisma.evaluation.create({
      data: {
        employeeId,
        evaluatorId: ewa.id,
        type: "OKRESOWA",
        sheet,
        status: "ZAKONCZONA",
        periodStart: db(addMonths(evaluatedAt, -23)),
        periodEnd: db(evaluatedAt),
        evaluatedAt: db(evaluatedAt),
        acknowledgedAt: db(addDays(evaluatedAt, 2)),
        result: s.result,
        overallLevel: s.overallLevel,
        average: s.average,
        justification: justification ?? null,
        developmentPlan: "Szkolenie specjalistyczne z obszaru zadań stanowiska; udział w pracach zespołu międzydepartamentowego.",
        criteria: {
          create: codes.map((competency, i) => ({ competency, kind: i < 5 ? "OBOWIAZKOWE" : "DODATKOWE", score: points[i], order: i })),
        },
      },
    });
    return { ...s, evaluatedAt };
  };

  type CriterionSeed = { competency: CompetencyCode; kind: "OBOWIAZKOWE" | "DODATKOWE"; selectionReason?: string };
  const currentCriteria = (sheet: "B" | "C", additional: { competency: CompetencyCode; reason: string }[] = []): CriterionSeed[] => [
    ...mandatoryCriteria(sheet).map((competency) => ({ competency, kind: "OBOWIAZKOWE" as const })),
    ...additional.map((a) => ({ competency: a.competency, kind: "DODATKOWE" as const, selectionReason: a.reason })),
  ];
  const criteriaCreate = (list: CriterionSeed[]): Prisma.EvaluationCriterionCreateWithoutEvaluationInput[] =>
    list.map((c, order) => ({ competency: c.competency, kind: c.kind, selectionReason: c.selectionReason ?? null, order }));

  let evaluations = 0;
  let observations = 0;

  // --- 1. Katarzyna Wójcik – radca (arkusz C): ocena za ok. 9 dni, główna ścieżka demo -----------------
  {
    const e = await employee({ firstName: "Katarzyna", lastName: "Wójcik", osp: "RADCA", employmentStart: "2019-03-01", permanentFrom: "2019-03-01", isCivilServant: true, appointmentYear: 2021, serviceGrade: 2 });
    const prevDate = addDays(addMonths(today, -24), 9);
    const prev = await pastPeriodic(e.id, "C", prevDate, ["WIEDZA", "RZETELNOSC", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA", "ANALITYCZNE"], [7, 5, 5, 7, 5, 7]);
    const due = periodicEvaluationDeadline({ anchor: { kind: "POPRZEDNIA_OCENA", date: prevDate } });
    const criteriaSetAt = addDays(prevDate, 14);
    const r = OSP_TASK(DEMO_OSP.RADCA, 0);
    await prisma.evaluation.create({
      data: {
        employeeId: e.id, evaluatorId: ewa.id, type: "OKRESOWA", sheet: "C", status: "W_OCENIE",
        periodStart: db(criteriaSetAt), dueDate: db(due.date), criteriaSetAt: db(criteriaSetAt),
        startChecklist: { obowiazki: true, kryteria: true, oczekiwania: true, cele: true },
        expectations: "Samodzielne przygotowywanie opinii indywidualnych; jasny język w korespondencji z przedsiębiorcami.",
        goals: "Opracowanie zestawu najczęstszych pytań i odpowiedzi dotyczących stosowania przepisów o AI.",
        previousResult: prev.result, previousLevel: prev.overallLevel, previousDate: db(prevDate),
        criteria: {
          create: criteriaCreate(
            currentCriteria("C", [
              { competency: "ANALITYCZNE", reason: `OSP, zadanie dominujące 1: „${r}”` },
              { competency: "KREATYWNOSC", reason: `OSP, zadanie 4: „${OSP_TASK(DEMO_OSP.RADCA, 3)}”` },
            ]),
          ),
        },
        conversations: { create: [{ employeeId: e.id, type: "ROZPOCZYNAJACA", date: db(criteriaSetAt), notes: "Omówiono obowiązki z OSP, kryteria (w tym dodatkowe: myślenie analityczne, kreatywność), oczekiwania i cel." }] },
      },
    });
    await prisma.conversation.create({ data: { employeeId: e.id, type: "BIEZACA", date: db(d(-100)), notes: "Informacja zwrotna po spotkaniu z izbami gospodarczymi – bardzo dobra prezentacja." } });
    observations += (await addObservations(e.id, OBS_KATARZYNA)).count;
    evaluations += 2;
    await prisma.reminder.create({
      data: {
        recipientId: ewa.id, employeeId: e.id, kind: "OCENA_OKRESOWA", dueDate: db(due.date),
        subject: "Zbliża się termin oceny okresowej – Katarzyna Wójcik",
        body: `${due.explanation.text}\nPrzeprowadź rozmowę oceniającą i sporządź ocenę na piśmie.`,
        sentAt: new Date(`${d(-1)}T08:00:00Z`),
      },
    });
  }

  // --- 2. Piotr Lewandowski – naczelnik (arkusz B, 5–9 podległych) -----------------------------------
  {
    const e = await employee({ firstName: "Piotr", lastName: "Lewandowski", osp: "NACZELNIK", employmentStart: "2015-06-01", permanentFrom: "2015-06-01", isCivilServant: true, appointmentYear: 2017, serviceGrade: 4 });
    const prevDate = addDays(addMonths(today, -24), 45);
    const prev = await pastPeriodic(e.id, "B", prevDate, ["LUDZIE", "DECYZJE", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA"], [7, 5, 7, 7, 7]);
    const due = periodicEvaluationDeadline({ anchor: { kind: "POPRZEDNIA_OCENA", date: prevDate } });
    const criteriaSetAt = addDays(prevDate, 10);
    await prisma.evaluation.create({
      data: {
        employeeId: e.id, evaluatorId: ewa.id, type: "OKRESOWA", sheet: "B", status: "W_OKRESIE_OCENY",
        periodStart: db(criteriaSetAt), dueDate: db(due.date), criteriaSetAt: db(criteriaSetAt),
        startChecklist: { obowiazki: true, kryteria: true, oczekiwania: true, cele: false },
        previousResult: prev.result, previousLevel: prev.overallLevel, previousDate: db(prevDate),
        criteria: {
          create: criteriaCreate(
            currentCriteria("B", [
              { competency: "WYSTAPIENIA", reason: `OSP, zadanie 5: „${OSP_TASK(DEMO_OSP.NACZELNIK, 4)}”` },
              { competency: "NEGOCJOWANIE", reason: `OSP, zadanie 6: „${OSP_TASK(DEMO_OSP.NACZELNIK, 5)}”` },
            ]),
          ),
        },
        conversations: { create: [{ employeeId: e.id, type: "ROZPOCZYNAJACA", date: db(criteriaSetAt), notes: "Omówiono kryteria arkusza B i dodatkowe: wystąpienia publiczne, negocjowanie." }] },
      },
    });
    observations += (await addObservations(e.id, OBS_PIOTR)).count;
    evaluations += 2;
  }

  // --- 3. Jan Nowak – starszy specjalista (konto ocenianego): L4 44 dni wydłuża termin ---------------
  {
    const e = await employee({ firstName: "Jan", lastName: "Nowak", osp: "STARSZY_SPECJALISTA", employmentStart: "2020-01-02", permanentFrom: "2020-01-02" });
    await prisma.user.update({ where: { id: janUser.id }, data: { employeeId: e.id } });
    const prevDate = addDays(addMonths(today, -24), 6);
    const prev = await pastPeriodic(e.id, "C", prevDate, ["WIEDZA", "RZETELNOSC", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA", "KRYZYS"], [5, 5, 5, 5, 5, 7]);
    const absences: AbsencePeriod[] = [
      { kind: "ZWOLNIENIE_LEKARSKIE", from: d(-210), to: d(-167) }, // 44 dni – ponad miesiąc, wydłuża termin
      { kind: "URLOP_BEZPLATNY", from: d(-120), to: d(-101) }, // 20 dni – nie wydłuża
    ];
    for (const a of absences) await prisma.absence.create({ data: { employeeId: e.id, kind: a.kind, from: db(a.from), to: db(a.to) } });
    const due = periodicEvaluationDeadline({ anchor: { kind: "POPRZEDNIA_OCENA", date: prevDate }, absences });
    const criteriaSetAt = addDays(prevDate, 20);
    await prisma.evaluation.create({
      data: {
        employeeId: e.id, evaluatorId: ewa.id, type: "OKRESOWA", sheet: "C", status: "W_OKRESIE_OCENY",
        periodStart: db(criteriaSetAt), dueDate: db(due.date), criteriaSetAt: db(criteriaSetAt),
        startChecklist: { obowiazki: true, kryteria: true, oczekiwania: true, cele: false },
        previousResult: prev.result, previousLevel: prev.overallLevel, previousDate: db(prevDate),
        criteria: {
          create: criteriaCreate(
            currentCriteria("C", [
              { competency: "KRYZYS", reason: `OSP, zadanie dominujące 1: „${OSP_TASK(DEMO_OSP.STARSZY_SPECJALISTA, 0)}”` },
              { competency: "ANALITYCZNE", reason: `OSP, zadanie 6: „${OSP_TASK(DEMO_OSP.STARSZY_SPECJALISTA, 5)}”` },
            ]),
          ),
        },
        conversations: { create: [{ employeeId: e.id, type: "ROZPOCZYNAJACA", date: db(criteriaSetAt), notes: "Omówiono kryteria, w tym radzenie sobie w sytuacjach kryzysowych." }] },
      },
    });
    observations += (await addObservations(e.id, OBS_JAN)).count;
    evaluations += 2;
  }

  // --- 4. Marcin Wróbel – po ocenie negatywnej: ponowna ocena po 6 miesiącach (wcześniej ocena pozytywna) -------------------------
  {
    const e = await employee({ firstName: "Marcin", lastName: "Wróbel", osp: "STARSZY_SPECJALISTA", employmentStart: "2021-09-01", permanentFrom: "2021-09-01" });
    const evaluatedAt = d(-40);
    // Wcześniejszy cykl (pozytywny) – trzecia sporządzona ocena w komórce, więc Lustro ocen (Z36) pokazuje rozkład
    // (próg anonimowości: co najmniej 3 oceny w komórce).
    await pastPeriodic(e.id, "C", addMonths(evaluatedAt, -24), ["WIEDZA", "RZETELNOSC", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA"], [5, 5, 5, 3, 5]);
    const prev = await pastPeriodic(
      e.id, "C", evaluatedAt,
      ["WIEDZA", "RZETELNOSC", "ORGANIZACJA", "WSPOLPRACA", "KOMUNIKACJA"], [3, 3, 5, 3, 5],
      "Powtarzające się opóźnienia w realizacji zadań kontrolnych i braki w dokumentacji (trzy przypadki w okresie oceny) oraz słaby przepływ informacji w zespole.",
    );
    const [conv, reeval] = afterNegativeDeadlines({ evaluatedAt, acknowledgedAt: addDays(evaluatedAt, 2) });
    const criteriaSetAt = d(-35); // w terminie 7 dni od oceny negatywnej (§ 7 pkt 2)
    await prisma.evaluation.create({
      data: {
        employeeId: e.id, evaluatorId: ewa.id, type: "OKRESOWA", sheet: "C", status: "W_OKRESIE_OCENY", isReevaluation: true,
        periodStart: db(criteriaSetAt), dueDate: db((reeval ?? conv)!.date), criteriaSetAt: db(criteriaSetAt),
        startChecklist: { obowiazki: true, kryteria: true, oczekiwania: true, cele: true },
        expectations: "Terminowe zadania kontrolne, kompletna dokumentacja według listy kontrolnej, cotygodniowa informacja o postępach.",
        previousResult: prev.result, previousLevel: prev.overallLevel, previousDate: db(evaluatedAt),
        criteria: { create: criteriaCreate(currentCriteria("C")) },
        conversations: { create: [{ employeeId: e.id, type: "ROZPOCZYNAJACA", date: db(criteriaSetAt), notes: "Rozmowa po ocenie negatywnej: omówiono przyczyny, plan poprawy i cotygodniowe krótkie spotkania." }] },
      },
    });
    observations += (await addObservations(e.id, OBS_MARCIN)).count;
    evaluations += 3;
  }

  // --- 5. Aleksandra Mazur – nowa pracownica, pierwsza ocena ------------------------------------------
  {
    const start = d(-15);
    const contractEnd = addDays(addMonths(start, 12), -1);
    const e = await employee({ firstName: "Aleksandra", lastName: "Mazur", osp: "STARSZY_SPECJALISTA", employmentStart: start, contractEnd, unitHead: true });
    const window = firstEvalWindow({ employmentStart: start, contractEnd });
    const latest = window.find((w) => w.kind === "PIERWSZA_OCENA_DO") ?? window[window.length - 1]!;
    await prisma.evaluation.create({
      data: {
        employeeId: e.id, evaluatorId: ewa.id, type: "PIERWSZA", sheet: "PIERWSZA", status: "DO_ROZPOCZECIA",
        periodStart: db(start), dueDate: db(latest.date),
        criteria: { create: criteriaCreate(["RZETELNOSC", "WIEDZA", "ORGANIZACJA", "KOMUNIKACJA", "WSPOLPRACA"].map((c) => ({ competency: c as CompetencyCode, kind: "OBOWIAZKOWE" as const }))) },
      },
    });
    observations += (await addObservations(e.id, OBS_ALEKSANDRA)).count;
    evaluations += 1;
    const wstepna = initialConversationDeadline(start);
    await prisma.reminder.create({
      data: {
        recipientId: ewa.id, employeeId: e.id, kind: "ROZMOWA_WSTEPNA", dueDate: db(wstepna.date),
        subject: "Rozmowa wstępna z nową pracownicą – Aleksandra Mazur",
        body: `${wstepna.explanation.text}`,
      },
    });
  }

  // --- 6. Marta Kamińska – radca, zatrudniona na czas nieokreślony 12 dni temu: ocena do rozpoczęcia -----
  {
    const permanentFrom = d(-12);
    const e = await employee({ firstName: "Marta", lastName: "Kamińska", osp: "RADCA", employmentStart: addMonths(permanentFrom, -12), permanentFrom });
    const conv = criteriaConversationDeadline({ kind: "ZATRUDNIENIE_NA_CZAS_NIEOKRESLONY", date: permanentFrom });
    await prisma.evaluation.create({
      data: { employeeId: e.id, evaluatorId: ewa.id, type: "OKRESOWA", sheet: "C", status: "DO_ROZPOCZECIA", dueDate: null },
    });
    await prisma.reminder.create({
      data: {
        recipientId: ewa.id, employeeId: e.id, kind: "ROZMOWA_ROZPOCZYNAJACA", dueDate: db(conv.date),
        subject: "Rozmowa rozpoczynająca ocenę okresową – Marta Kamińska",
        body: conv.explanation.text,
      },
    });
    evaluations += 1;
  }

  await prisma.appInfo.upsert({
    where: { key: "dane-demo" },
    update: { value: today },
    create: { key: "dane-demo", value: today },
  });

  const employees = await prisma.employee.count();
  return { today: fromDbDate(db(today)), employees, evaluations, observations };
}

/** Zadanie z OSP (dominujące, potem pozostałe) do uzasadnienia wyboru kryterium dodatkowego. */
function OSP_TASK(o: OspEntry, index: number): string {
  const all = [...o.dominantTasks, ...o.otherTasks];
  const t = all[index] ?? all[0] ?? "";
  return t.length > 160 ? `${t.slice(0, 160).replace(/\s+\S*$/, "")}…` : t;
}

/** „Departament X Wydział Y” → ["Departament X", "Wydział Y"]. */
function splitUnit(name: string): string[] {
  const i = name.indexOf(" Wydział ");
  return i === -1 ? [name] : [name.slice(0, i), name.slice(i + 1)];
}
