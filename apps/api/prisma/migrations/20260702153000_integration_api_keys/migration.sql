-- CreateTable
CREATE TABLE "IntegrationApiKey" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'openclaw',
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyLast4" TEXT NOT NULL,
    "scopesJson" TEXT NOT NULL,
    "lastUsedAt" DATETIME,
    "expiresAt" DATETIME,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "IntegrationApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "IntegrationApiKey_keyHash_key" ON "IntegrationApiKey"("keyHash");

-- CreateIndex
CREATE INDEX "IntegrationApiKey_userId_idx" ON "IntegrationApiKey"("userId");

-- CreateIndex
CREATE INDEX "IntegrationApiKey_provider_idx" ON "IntegrationApiKey"("provider");

-- CreateIndex
CREATE INDEX "IntegrationApiKey_keyPrefix_idx" ON "IntegrationApiKey"("keyPrefix");
