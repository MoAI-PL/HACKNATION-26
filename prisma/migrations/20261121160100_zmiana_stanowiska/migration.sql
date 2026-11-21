-- CreateTable
CREATE TABLE "PositionChange" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "significantDutiesChange" BOOLEAN NOT NULL DEFAULT true,
    "newPositionTitle" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositionChange_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PositionChange_employeeId_idx" ON "PositionChange"("employeeId");

-- AddForeignKey
ALTER TABLE "PositionChange" ADD CONSTRAINT "PositionChange_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
