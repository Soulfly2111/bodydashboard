CREATE TABLE "BodyMeasurementType" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'cm',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "BodyPhoto" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "date" DATETIME NOT NULL,
  "viewType" TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "notes" TEXT,
  "linkedWeightEntryId" TEXT,
  "trainingPhase" TEXT,
  "dietPhase" TEXT,
  "referenceObject" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BodyPhoto_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BodyMeasurement" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "date" DATETIME NOT NULL,
  "measurementTypeId" TEXT,
  "measurementType" TEXT NOT NULL,
  "value" REAL NOT NULL,
  "unit" TEXT NOT NULL DEFAULT 'cm',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "confidence" INTEGER,
  "confirmedByUser" BOOLEAN NOT NULL DEFAULT true,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BodyMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BodyMeasurement_measurementTypeId_fkey" FOREIGN KEY ("measurementTypeId") REFERENCES "BodyMeasurementType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "BodyPhotoAnalysis" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "photoId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "detectedViewType" TEXT,
  "imageQualityScore" INTEGER,
  "estimatedMeasurementsJson" TEXT,
  "confidenceJson" TEXT,
  "analysisText" TEXT NOT NULL,
  "warnings" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BodyPhotoAnalysis_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "BodyPhoto" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "BodyProgressComparison" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "fromDate" DATETIME NOT NULL,
  "toDate" DATETIME NOT NULL,
  "summaryJson" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "BodyProgressSettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "aiMode" TEXT NOT NULL DEFAULT 'SHOW_ONLY',
  "minConfidenceForAutoApply" INTEGER NOT NULL DEFAULT 90,
  "useHeightAsReference" BOOLEAN NOT NULL DEFAULT true,
  "localStorageOnly" BOOLEAN NOT NULL DEFAULT true,
  "encryptedStorage" BOOLEAN NOT NULL DEFAULT false,
  "deletePhotosAfterAnalysis" BOOLEAN NOT NULL DEFAULT false,
  "maxImageSizeMb" INTEGER NOT NULL DEFAULT 8,
  "stripExif" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "BodyProgressSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BodyMeasurementType_slug_key" ON "BodyMeasurementType"("slug");
CREATE INDEX "BodyPhoto_userId_date_idx" ON "BodyPhoto"("userId", "date");
CREATE INDEX "BodyPhoto_viewType_idx" ON "BodyPhoto"("viewType");
CREATE INDEX "BodyMeasurement_userId_date_idx" ON "BodyMeasurement"("userId", "date");
CREATE INDEX "BodyMeasurement_measurementType_idx" ON "BodyMeasurement"("measurementType");
CREATE INDEX "BodyPhotoAnalysis_photoId_idx" ON "BodyPhotoAnalysis"("photoId");
CREATE INDEX "BodyProgressComparison_userId_fromDate_toDate_idx" ON "BodyProgressComparison"("userId", "fromDate", "toDate");
CREATE UNIQUE INDEX "BodyProgressSettings_userId_key" ON "BodyProgressSettings"("userId");
