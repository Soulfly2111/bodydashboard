-- CreateTable
CREATE TABLE "MealHousehold" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "servings" INTEGER NOT NULL DEFAULT 4,
    "dishCount" INTEGER NOT NULL DEFAULT 3,
    "preferences" TEXT NOT NULL DEFAULT 'Überwiegend pflanzlich und proteinreich',
    "budgetCents" INTEGER,
    "autoPlan" BOOLEAN NOT NULL DEFAULT false,
    "autoPlanSince" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MealHouseholdMember" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "MealHouseholdMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MealHouseholdMember_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "MealHousehold" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealHouseholdInvite" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "acceptedAt" DATETIME,
    CONSTRAINT "MealHouseholdInvite_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "MealHousehold" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipePlanning" (
    "recipeId" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT,
    "activeMinutes" INTEGER,
    "ingredients" TEXT,
    CONSTRAINT "RecipePlanning_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipePlanning_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "MealHousehold" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeFeedback" (
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,

    PRIMARY KEY ("recipeId", "userId"),
    CONSTRAINT "RecipeFeedback_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyMealPlan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "weekStart" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklyMealPlan_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "MealHousehold" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WeeklyMealDish" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "planId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "servings" INTEGER NOT NULL,
    "recipeId" TEXT,
    "snapshot" TEXT NOT NULL,
    "images" TEXT,
    "cookedAt" DATETIME,
    "leftoverPortions" REAL NOT NULL DEFAULT 0,
    "leftoverUntil" TEXT,
    CONSTRAINT "WeeklyMealDish_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyMealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecipeConsumption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "requestBody" TEXT NOT NULL,
    "mealItemId" TEXT,
    "date" TEXT NOT NULL,
    "portions" REAL NOT NULL,
    "snapshot" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeConsumption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeConsumption_mealItemId_fkey" FOREIGN KEY ("mealItemId") REFERENCES "MealItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealPlannerJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "jobKey" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'queued',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" DATETIME,
    "leaseToken" TEXT,
    "error" TEXT,
    "result" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealPlannerJob_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "MealHousehold" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealShoppingList" (
    "planId" TEXT NOT NULL PRIMARY KEY,
    "items" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "state" TEXT NOT NULL DEFAULT 'preview',
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MealShoppingList_planId_fkey" FOREIGN KEY ("planId") REFERENCES "WeeklyMealPlan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MealPantryItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "householdId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "expiresOn" TEXT,
    CONSTRAINT "MealPantryItem_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "MealHousehold" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MealHouseholdMember_householdId_idx" ON "MealHouseholdMember"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "MealHouseholdInvite_tokenHash_key" ON "MealHouseholdInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "MealHouseholdInvite_householdId_idx" ON "MealHouseholdInvite"("householdId");

-- CreateIndex
CREATE INDEX "RecipePlanning_householdId_idx" ON "RecipePlanning"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMealPlan_householdId_weekStart_key" ON "WeeklyMealPlan"("householdId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMealDish_planId_position_key" ON "WeeklyMealDish"("planId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeConsumption_mealItemId_key" ON "RecipeConsumption"("mealItemId");

-- CreateIndex
CREATE INDEX "RecipeConsumption_userId_date_idx" ON "RecipeConsumption"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeConsumption_userId_requestKey_key" ON "RecipeConsumption"("userId", "requestKey");

-- CreateIndex
CREATE INDEX "MealPlannerJob_state_leaseUntil_idx" ON "MealPlannerJob"("state", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "MealPlannerJob_householdId_kind_jobKey_key" ON "MealPlannerJob"("householdId", "kind", "jobKey");

-- CreateIndex
CREATE INDEX "MealPantryItem_householdId_idx" ON "MealPantryItem"("householdId");
