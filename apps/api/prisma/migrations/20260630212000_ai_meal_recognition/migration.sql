CREATE TABLE "AiRecognitionSetting" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "mode" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "minConfidence" INTEGER NOT NULL DEFAULT 90,
  "storeImages" BOOLEAN NOT NULL DEFAULT false,
  "deleteAfterAnalysis" BOOLEAN NOT NULL DEFAULT true,
  "linkImageToMeal" BOOLEAN NOT NULL DEFAULT false,
  "provider" TEXT NOT NULL DEFAULT 'local',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AiRecognitionSetting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "AiMealAnalysis" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "mealId" TEXT,
  "date" DATETIME NOT NULL,
  "mealType" TEXT NOT NULL,
  "customMealTag" TEXT,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "mode" TEXT NOT NULL DEFAULT 'REVIEW_REQUIRED',
  "confidence" INTEGER NOT NULL DEFAULT 0,
  "imagePath" TEXT,
  "imageFileName" TEXT,
  "imageMimeType" TEXT,
  "imageSha256" TEXT,
  "rawResultJson" TEXT,
  "manualChangesJson" TEXT,
  "totalsJson" TEXT,
  "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AiMealAnalysis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AiMealAnalysis_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "AiMealAnalysisItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "analysisId" TEXT NOT NULL,
  "foodId" TEXT,
  "name" TEXT NOT NULL,
  "category" TEXT,
  "amount" REAL NOT NULL,
  "weightGrams" REAL NOT NULL,
  "servingName" TEXT,
  "calories" REAL NOT NULL,
  "protein" REAL NOT NULL,
  "carbs" REAL NOT NULL,
  "fat" REAL NOT NULL,
  "fiber" REAL NOT NULL DEFAULT 0,
  "sugar" REAL NOT NULL DEFAULT 0,
  "salt" REAL NOT NULL DEFAULT 0,
  "confidence" INTEGER NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'ai_estimate',
  "thumbnailPath" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "AiMealAnalysisItem_analysisId_fkey" FOREIGN KEY ("analysisId") REFERENCES "AiMealAnalysis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "AiRecognitionSetting_userId_key" ON "AiRecognitionSetting"("userId");
CREATE INDEX "AiMealAnalysis_userId_date_idx" ON "AiMealAnalysis"("userId", "date");
CREATE INDEX "AiMealAnalysis_userId_status_idx" ON "AiMealAnalysis"("userId", "status");
