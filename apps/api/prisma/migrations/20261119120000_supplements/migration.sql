-- CreateTable
CREATE TABLE "Supplement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "defaultKey" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT,
    "unit" TEXT NOT NULL,
    "defaultAmount" REAL,
    "color" TEXT NOT NULL DEFAULT '#00d4df',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "calories" REAL,
    "protein" REAL,
    "fat" REAL,
    "carbs" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Supplement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SupplementEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "supplementId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "calories" REAL,
    "protein" REAL,
    "fat" REAL,
    "carbs" REAL,
    "externalId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupplementEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SupplementEntry_supplementId_fkey" FOREIGN KEY ("supplementId") REFERENCES "Supplement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Supplement_userId_idx" ON "Supplement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplement_userId_defaultKey_key" ON "Supplement"("userId", "defaultKey");

-- CreateIndex
CREATE INDEX "SupplementEntry_userId_date_idx" ON "SupplementEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "SupplementEntry_userId_externalId_key" ON "SupplementEntry"("userId", "externalId");

-- Legacy OpenClaw keys previously received implicit wildcard access in code.
-- Preserve their effective permissions explicitly; new keys respect their exact scopes.
UPDATE "IntegrationApiKey" SET "scopesJson" = '["*"]' WHERE lower("provider") = 'openclaw';
