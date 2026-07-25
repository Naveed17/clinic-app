-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_LabOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "orderedById" TEXT NOT NULL,
    "tokenId" TEXT,
    "test" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "result" TEXT,
    "notes" TEXT,
    "orderedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LabOrder_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LabOrder_orderedById_fkey" FOREIGN KEY ("orderedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LabOrder_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "Token" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LabOrder" ("createdAt", "id", "notes", "orderedAt", "orderedById", "patientId", "result", "status", "test", "updatedAt") SELECT "createdAt", "id", "notes", "orderedAt", "orderedById", "patientId", "result", "status", "test", "updatedAt" FROM "LabOrder";
DROP TABLE "LabOrder";
ALTER TABLE "new_LabOrder" RENAME TO "LabOrder";
CREATE INDEX "LabOrder_patientId_idx" ON "LabOrder"("patientId");
CREATE INDEX "LabOrder_orderedById_idx" ON "LabOrder"("orderedById");
CREATE INDEX "LabOrder_tokenId_idx" ON "LabOrder"("tokenId");
CREATE INDEX "LabOrder_status_idx" ON "LabOrder"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
