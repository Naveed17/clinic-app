-- CreateTable
CREATE TABLE "DoctorAttendance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "doctorId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "checkInAt" DATETIME NOT NULL,
    "checkOutAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DoctorAttendance_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DoctorAttendance_doctorId_idx" ON "DoctorAttendance"("doctorId");

-- CreateIndex
CREATE INDEX "DoctorAttendance_date_idx" ON "DoctorAttendance"("date");

-- CreateIndex
CREATE UNIQUE INDEX "DoctorAttendance_doctorId_date_key" ON "DoctorAttendance"("doctorId", "date");
