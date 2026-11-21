-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PRZELOZONY', 'HR', 'OCENIANY', 'KIERUJACY_KOMORKA');

-- CreateEnum
CREATE TYPE "EvaluationType" AS ENUM ('PIERWSZA', 'OKRESOWA');

-- CreateEnum
CREATE TYPE "Sheet" AS ENUM ('A', 'B', 'C', 'PIERWSZA');

-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DO_ROZPOCZECIA', 'W_OKRESIE_OCENY', 'W_OCENIE', 'CZEKA_NA_ZAPOZNANIE', 'ZAKONCZONA');

-- CreateEnum
CREATE TYPE "CriterionKind" AS ENUM ('OBOWIAZKOWE', 'DODATKOWE');

-- CreateEnum
CREATE TYPE "EvaluationResult" AS ENUM ('POZYTYWNA', 'NEGATYWNA');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('ZNACZNIE_PONIZEJ', 'PONIZEJ', 'NA_POZIOMIE', 'POWYZEJ', 'ZNACZNIE_POWYZEJ');

-- CreateEnum
CREATE TYPE "ConversationType" AS ENUM ('WSTEPNA', 'ROZPOCZYNAJACA', 'OCENIAJACA', 'BIEZACA');

-- CreateEnum
CREATE TYPE "ObservationSource" AS ENUM ('RECZNA', 'SZYBKA_AI');

-- CreateEnum
CREATE TYPE "SubordinateOption" AS ENUM ('BRAK', 'DO_4', 'OD_5_DO_9', 'POWYZEJ_9', 'PODLEGAJA_KIERUJACY');

-- CreateEnum
CREATE TYPE "AbsenceKind" AS ENUM ('ZWOLNIENIE_LEKARSKIE', 'URLOP_MACIERZYNSKI', 'URLOP_RODZICIELSKI', 'URLOP_OJCOWSKI', 'URLOP_WYCHOWAWCZY', 'URLOP_BEZPLATNY', 'INNA');

-- CreateEnum
CREATE TYPE "ExamResult" AS ENUM ('ZDANY', 'NIEZDANY', 'NIE_DOTYCZY');

-- CreateEnum
CREATE TYPE "ExamExemption" AS ENUM ('ABSOLWENT_KSAP', 'ZASTEPSTWO', 'WYZSZE_STANOWISKO');

-- CreateEnum
CREATE TYPE "CompetencyCode" AS ENUM ('RZETELNOSC', 'KOMUNIKACJA', 'WIEDZA', 'ORGANIZACJA', 'KREATYWNOSC', 'WSPOLPRACA', 'ANALITYCZNE', 'NEGOCJOWANIE', 'WYSTAPIENIA', 'KLIENT', 'KRYZYS', 'STRATEGICZNE', 'LUDZIE', 'DECYZJE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "employeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgUnit" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "parentId" TEXT,

    CONSTRAINT "OrgUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isCivilServant" BOOLEAN NOT NULL DEFAULT false,
    "employmentStart" DATE NOT NULL,
    "permanentFrom" DATE,
    "contractEnd" DATE,
    "orgUnitId" TEXT,
    "positionId" TEXT,
    "supervisorId" TEXT,
    "unitHeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Position" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "orgUnitId" TEXT,
    "purpose" TEXT NOT NULL,
    "dominantTasks" JSONB NOT NULL,
    "otherTasks" JSONB NOT NULL,
    "subordinates" "SubordinateOption" NOT NULL,
    "authorizations" TEXT,
    "requiredCompetencies" JSONB NOT NULL,
    "rawText" TEXT,
    "sourceFileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "evaluatorId" TEXT NOT NULL,
    "type" "EvaluationType" NOT NULL,
    "sheet" "Sheet" NOT NULL,
    "sheetOverridden" BOOLEAN NOT NULL DEFAULT false,
    "status" "EvaluationStatus" NOT NULL DEFAULT 'DO_ROZPOCZECIA',
    "periodStart" DATE,
    "periodEnd" DATE,
    "dueDate" DATE,
    "criteriaSetAt" DATE,
    "startChecklist" JSONB,
    "expectations" TEXT,
    "goals" TEXT,
    "isReevaluation" BOOLEAN NOT NULL DEFAULT false,
    "evaluatedAt" DATE,
    "acknowledgedAt" DATE,
    "result" "EvaluationResult",
    "overallLevel" "Level",
    "average" DOUBLE PRECISION,
    "justification" TEXT,
    "developmentPlan" TEXT,
    "previousResult" "EvaluationResult",
    "previousLevel" "Level",
    "previousDate" DATE,
    "promotionRequest" BOOLEAN NOT NULL DEFAULT false,
    "promotionJustification" TEXT,
    "examResult" "ExamResult",
    "examExemption" "ExamExemption",
    "lastWizardStep" TEXT,
    "wizardState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationCriterion" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "competency" "CompetencyCode" NOT NULL,
    "kind" "CriterionKind" NOT NULL,
    "selectionReason" TEXT,
    "score" INTEGER,
    "suggestedScore" INTEGER,
    "overrideReason" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EvaluationCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndicatorRating" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "indicatorId" TEXT NOT NULL,
    "level" INTEGER,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndicatorRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Observation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "competency" "CompetencyCode",
    "indicatorId" TEXT,
    "behaviorLevel" INTEGER,
    "situation" TEXT,
    "action" TEXT,
    "outcome" TEXT,
    "originalText" TEXT,
    "source" "ObservationSource" NOT NULL DEFAULT 'RECZNA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Observation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "evaluationId" TEXT,
    "type" "ConversationType" NOT NULL,
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirstEvalReport" (
    "id" TEXT NOT NULL,
    "evaluationId" TEXT NOT NULL,
    "dueFrom" DATE NOT NULL,
    "dueTo" DATE NOT NULL,
    "submittedAt" DATE,
    "content" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirstEvalReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "AbsenceKind" NOT NULL,
    "from" DATE NOT NULL,
    "to" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reminder" (
    "id" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "employeeId" TEXT,
    "evaluationId" TEXT,
    "kind" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "aiProposal" JSONB,
    "humanDecision" JSONB,
    "oldValue" JSONB,
    "newValue" JSONB,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistantQuery" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "question" TEXT NOT NULL,
    "sources" JSONB NOT NULL,
    "answer" TEXT NOT NULL,
    "refused" BOOLEAN NOT NULL DEFAULT false,
    "step" TEXT,
    "model" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantQuery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppInfo" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppInfo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_employeeId_key" ON "User"("employeeId");

-- CreateIndex
CREATE INDEX "Employee_supervisorId_idx" ON "Employee"("supervisorId");

-- CreateIndex
CREATE INDEX "Evaluation_employeeId_idx" ON "Evaluation"("employeeId");

-- CreateIndex
CREATE INDEX "Evaluation_evaluatorId_status_idx" ON "Evaluation"("evaluatorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "EvaluationCriterion_evaluationId_competency_key" ON "EvaluationCriterion"("evaluationId", "competency");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorRating_criterionId_indicatorId_key" ON "IndicatorRating"("criterionId", "indicatorId");

-- CreateIndex
CREATE INDEX "Observation_employeeId_date_idx" ON "Observation"("employeeId", "date");

-- CreateIndex
CREATE INDEX "Observation_indicatorId_idx" ON "Observation"("indicatorId");

-- CreateIndex
CREATE UNIQUE INDEX "FirstEvalReport_evaluationId_key" ON "FirstEvalReport"("evaluationId");

-- CreateIndex
CREATE INDEX "Absence_employeeId_idx" ON "Absence"("employeeId");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AppInfo_key_key" ON "AppInfo"("key");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgUnit" ADD CONSTRAINT "OrgUnit_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "Position"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_unitHeadId_fkey" FOREIGN KEY ("unitHeadId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Position" ADD CONSTRAINT "Position_orgUnitId_fkey" FOREIGN KEY ("orgUnitId") REFERENCES "OrgUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationCriterion" ADD CONSTRAINT "EvaluationCriterion_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IndicatorRating" ADD CONSTRAINT "IndicatorRating_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "EvaluationCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Observation" ADD CONSTRAINT "Observation_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirstEvalReport" ADD CONSTRAINT "FirstEvalReport_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reminder" ADD CONSTRAINT "Reminder_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistantQuery" ADD CONSTRAINT "AssistantQuery_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

