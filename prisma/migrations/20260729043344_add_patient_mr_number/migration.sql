/*
  Warnings:

  - Added the required column `mrNumber` to the `Patient` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mrNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "dateOfBirth" DATETIME,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "emergencyContactName" TEXT,
    "emergencyContactPhone" TEXT,
    "bloodGroup" TEXT,
    "allergies" TEXT,
    "chronicConditions" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Patient" ("address", "allergies", "bloodGroup", "chronicConditions", "createdAt", "dateOfBirth", "email", "emergencyContactName", "emergencyContactPhone", "firstName", "id", "lastName", "phone", "updatedAt") SELECT "address", "allergies", "bloodGroup", "chronicConditions", "createdAt", "dateOfBirth", "email", "emergencyContactName", "emergencyContactPhone", "firstName", "id", "lastName", "phone", "updatedAt" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_mrNumber_key" ON "Patient"("mrNumber");
CREATE INDEX "Patient_lastName_firstName_idx" ON "Patient"("lastName", "firstName");
CREATE INDEX "Patient_phone_idx" ON "Patient"("phone");
CREATE INDEX "Patient_mrNumber_idx" ON "Patient"("mrNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
