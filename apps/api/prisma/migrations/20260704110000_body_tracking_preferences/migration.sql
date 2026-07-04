-- AlterTable
ALTER TABLE "User" ADD COLUMN "trackWeight" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "trackBodyFat" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "trackMuscleMass" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN "trackWater" BOOLEAN NOT NULL DEFAULT true;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeightEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "weightKg" REAL,
    "bodyFatPercent" REAL,
    "muscleMassKg" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WeightEntry" ("createdAt", "date", "id", "userId", "weightKg") SELECT "createdAt", "date", "id", "userId", "weightKg" FROM "WeightEntry";
DROP TABLE "WeightEntry";
ALTER TABLE "new_WeightEntry" RENAME TO "WeightEntry";
CREATE UNIQUE INDEX "WeightEntry_userId_date_key" ON "WeightEntry"("userId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
