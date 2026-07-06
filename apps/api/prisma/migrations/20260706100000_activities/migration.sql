CREATE TABLE "ActivityType" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "defaultMet" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "METValue" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "activityTypeId" TEXT NOT NULL,
  "intensity" TEXT NOT NULL,
  "met" REAL NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "METValue_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Activity" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "activityTypeId" TEXT,
  "typeName" TEXT NOT NULL,
  "date" DATETIME NOT NULL,
  "startTime" TEXT,
  "endTime" TEXT,
  "durationMinutes" INTEGER NOT NULL,
  "intensity" TEXT NOT NULL DEFAULT 'MEDIUM',
  "distanceKm" REAL,
  "averageSpeedKmh" REAL,
  "averageHeartRate" INTEGER,
  "maxHeartRate" INTEGER,
  "calories" REAL NOT NULL,
  "caloriesOverride" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "steps" INTEGER,
  "elevationGainM" REAL,
  "powerWatts" REAL,
  "cadence" REAL,
  "pace" TEXT,
  "source" TEXT NOT NULL DEFAULT 'manual',
  "externalId" TEXT,
  "muscleGroupsJson" TEXT,
  "exercisesCount" INTEGER,
  "setsCount" INTEGER,
  "repsCount" INTEGER,
  "trainingVolume" REAL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Activity_activityTypeId_fkey" FOREIGN KEY ("activityTypeId") REFERENCES "ActivityType" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "ActivityGoal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "trainingDaysPerWeek" INTEGER NOT NULL DEFAULT 3,
  "trainingMinutesPerWeek" INTEGER NOT NULL DEFAULT 180,
  "caloriesPerWeek" INTEGER NOT NULL DEFAULT 1500,
  "stepsPerDay" INTEGER NOT NULL DEFAULT 8000,
  "strengthSessionsPerWeek" INTEGER NOT NULL DEFAULT 2,
  "cardioSessionsPerWeek" INTEGER NOT NULL DEFAULT 2,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "ActivityGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Workout" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "activityId" TEXT,
  "name" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL,
  CONSTRAINT "Workout_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkoutExercise" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "workoutId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "muscleGroup" TEXT,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorkoutExercise_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkoutSet" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "exerciseId" TEXT NOT NULL,
  "reps" INTEGER,
  "weightKg" REAL,
  "durationSeconds" INTEGER,
  "distanceMeters" REAL,
  "order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "WorkoutSet_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "WorkoutExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ActivityType_slug_key" ON "ActivityType"("slug");
CREATE INDEX "ActivityType_category_idx" ON "ActivityType"("category");
CREATE UNIQUE INDEX "METValue_activityTypeId_intensity_key" ON "METValue"("activityTypeId", "intensity");
CREATE INDEX "Activity_userId_date_idx" ON "Activity"("userId", "date");
CREATE INDEX "Activity_activityTypeId_idx" ON "Activity"("activityTypeId");
CREATE INDEX "Activity_source_externalId_idx" ON "Activity"("source", "externalId");
CREATE UNIQUE INDEX "ActivityGoal_userId_key" ON "ActivityGoal"("userId");
CREATE UNIQUE INDEX "Workout_activityId_key" ON "Workout"("activityId");
CREATE INDEX "Workout_userId_idx" ON "Workout"("userId");
