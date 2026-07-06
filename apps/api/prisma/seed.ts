import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type Food } from "@prisma/client";
import { startOfDay, subDays } from "date-fns";
import { activityTypes, Intensities, metForIntensity } from "../src/services/activities/activityCatalog.js";

const prisma = new PrismaClient();

async function main() {
  await removeLegacyDemoUser();

  const admin = await upsertUser({
    username: "Heiner",
    email: "heiner@bodydashboard.local",
    name: "Heiner",
    firstName: "Heiner",
    password: "Heiner@1234!",
    role: "ADMIN"
  });

  const christoph = await upsertUser({
    username: "Christoph",
    email: "christoph@bodydashboard.local",
    name: "Christoph",
    firstName: "Christoph",
    password: "Christoph@123!",
    role: "USER"
  });

  await createSeedAuditLog(admin.id, admin.id, "seed.admin_created");
  await createSeedAuditLog(christoph.id, admin.id, "seed.user_created");

  await seedActivityTypes();
  await seedChristophData(christoph.id);
}

async function removeLegacyDemoUser() {
  await prisma.user.deleteMany({ where: { email: "demo@example.com" } });
}

async function createSeedAuditLog(userId: string, actorUserId: string, action: string) {
  const existing = await prisma.auditLog.findFirst({ where: { userId, action } });
  if (!existing) {
    await prisma.auditLog.create({ data: { userId, actorUserId, action, entityType: "User", entityId: userId } });
  }
}

async function upsertUser(input: { username: string; email: string; name: string; firstName: string; password: string; role: string }) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { username: input.username, role: input.role, status: "ACTIVE", name: input.name, firstName: input.firstName }
    });
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.create({
    data: {
      username: input.username,
      email: input.email,
      name: input.name,
      firstName: input.firstName,
      passwordHash,
      role: input.role,
      language: "de",
      timezone: "Europe/Berlin",
      theme: "system",
      heightCm: 180,
      goal: { create: { calories: 2200, protein: 150, carbs: 240, fat: 70, waterMl: 2800, weightKg: 78 } }
    }
  });
}

async function seedActivityTypes() {
  for (const type of activityTypes) {
    const activityType = await prisma.activityType.upsert({
      where: { slug: type.slug },
      update: { name: type.name, category: type.category, defaultMet: type.defaultMet },
      create: type
    });
    for (const intensity of Object.keys(Intensities)) {
      await prisma.mETValue.upsert({
        where: { activityTypeId_intensity: { activityTypeId: activityType.id, intensity } },
        update: { met: metForIntensity(type.defaultMet, intensity) },
        create: { activityTypeId: activityType.id, intensity, met: metForIntensity(type.defaultMet, intensity) }
      });
    }
  }
}

async function seedChristophData(userId: string) {
  const foodInputs = [
    { name: "Haferflocken", brand: "Basis", category: "Getreide", caloriesPer100g: 370, protein: 13, carbs: 60, fat: 7, fiber: 10, sugar: 1, salt: 0.02 },
    { name: "Skyr Natur", brand: "Nordic Dairy", category: "Milchprodukte", caloriesPer100g: 63, protein: 11, carbs: 4, fat: 0.2, fiber: 0, sugar: 4, salt: 0.1 },
    { name: "Banane", brand: "Frisch", category: "Obst", caloriesPer100g: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12, salt: 0 },
    { name: "Hähnchenbrust", brand: "Metzger", category: "Fleisch", caloriesPer100g: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, salt: 0.18 },
    { name: "Reis gekocht", brand: "Basis", category: "Beilage", caloriesPer100g: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, salt: 0.01 },
    { name: "Lachsfilet", brand: "Fjord", category: "Fisch", caloriesPer100g: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, sugar: 0, salt: 0.15 },
    { name: "Vollkornbrot", brand: "Bäckerei", category: "Brot", caloriesPer100g: 214, protein: 8.5, carbs: 38, fat: 3.5, fiber: 7, sugar: 3, salt: 1.2 }
  ];

  const foods: Food[] = [];
  for (const food of foodInputs) {
    foods.push(await prisma.food.upsert({
      where: { userId_externalId_source: { userId, externalId: food.name, source: "seed" } },
      update: food,
      create: { ...food, userId, externalId: food.name, source: "seed" }
    }));
  }

  for (let i = 0; i < 30; i += 1) {
    const date = startOfDay(subDays(new Date(), i));
    await prisma.weightEntry.upsert({
      where: { userId_date: { userId, date } },
      update: { weightKg: 82 - i * 0.05 },
      create: { userId, date, weightKg: 82 - i * 0.05 }
    });
    await prisma.waterEntry.createMany({ data: [{ userId, date, amountMl: 750 }, { userId, date, amountMl: 500 + (i % 4) * 250 }] });

    const mealPlan = [
      { type: "BREAKFAST", entries: [[0, 70], [1, 250], [2, 120]] },
      { type: "LUNCH", entries: [[3, 180], [4, 220]] },
      { type: "DINNER", entries: [[5, 160], [4, 180]] },
      { type: "SNACK", entries: [[6, 90], [2, 100]] }
    ] as const;
    for (const mealInput of mealPlan) {
      const meal = await prisma.meal.upsert({
        where: { userId_date_type: { userId, date, type: mealInput.type } },
        update: {},
        create: { userId, date, type: mealInput.type }
      });
      await prisma.mealItem.deleteMany({ where: { mealId: meal.id } });
      await prisma.mealItem.createMany({ data: mealInput.entries.map(([foodIndex, amount]) => ({ mealId: meal.id, foodId: foods[foodIndex].id, amount, unit: "g" })) });
    }
  }

  await prisma.activityGoal.upsert({
    where: { userId },
    update: { trainingDaysPerWeek: 4, trainingMinutesPerWeek: 240, caloriesPerWeek: 2200, stepsPerDay: 9000, strengthSessionsPerWeek: 2, cardioSessionsPerWeek: 2 },
    create: { userId, trainingDaysPerWeek: 4, trainingMinutesPerWeek: 240, caloriesPerWeek: 2200, stepsPerDay: 9000, strengthSessionsPerWeek: 2, cardioSessionsPerWeek: 2 }
  });
  await prisma.activity.deleteMany({ where: { userId, source: "seed" } });
  const seedActivities = [
    { typeName: "Krafttraining", durationMinutes: 65, intensity: "HIGH", calories: 420, exercisesCount: 7, setsCount: 22, repsCount: 180, trainingVolume: 8200 },
    { typeName: "Laufen", durationMinutes: 38, intensity: "HIGH", calories: 470, distanceKm: 6.2, averageHeartRate: 148, maxHeartRate: 171, steps: 7600 },
    { typeName: "Fahrrad", durationMinutes: 55, intensity: "MEDIUM", calories: 510, distanceKm: 18, averageHeartRate: 132, steps: 0 },
    { typeName: "Walking", durationMinutes: 45, intensity: "LIGHT", calories: 210, distanceKm: 4.2, steps: 5600 },
    { typeName: "Ganzkörpertraining", durationMinutes: 50, intensity: "MEDIUM", calories: 360, exercisesCount: 6, setsCount: 18, repsCount: 160, trainingVolume: 6200 }
  ];
  for (let i = 0; i < 30; i += 1) {
    if (i % 2 === 1 && i % 5 !== 0) continue;
    const template = seedActivities[i % seedActivities.length];
    const date = startOfDay(subDays(new Date(), i));
    const activityType = await prisma.activityType.findFirst({ where: { name: template.typeName } });
    await prisma.activity.create({
      data: {
        userId,
        activityTypeId: activityType?.id,
        typeName: template.typeName,
        date,
        startTime: i % 3 === 0 ? "18:00" : "07:30",
        durationMinutes: template.durationMinutes,
        intensity: template.intensity,
        calories: template.calories,
        source: "seed",
        distanceKm: "distanceKm" in template ? template.distanceKm : null,
        averageHeartRate: "averageHeartRate" in template ? template.averageHeartRate : null,
        maxHeartRate: "maxHeartRate" in template ? template.maxHeartRate : null,
        steps: "steps" in template ? template.steps : null,
        exercisesCount: "exercisesCount" in template ? template.exercisesCount : null,
        setsCount: "setsCount" in template ? template.setsCount : null,
        repsCount: "repsCount" in template ? template.repsCount : null,
        trainingVolume: "trainingVolume" in template ? template.trainingVolume : null,
        muscleGroupsJson: template.typeName.includes("training") || template.typeName.includes("Ganz") ? JSON.stringify(["Brust", "Rücken", "Beine"]) : null,
        notes: "Seed-Aktivität"
      }
    });
  }

  await prisma.favorite.upsert({ where: { userId_type_targetId: { userId, type: "FOOD", targetId: foods[1].id } }, update: { label: foods[1].name }, create: { userId, type: "FOOD", targetId: foods[1].id, label: foods[1].name } });

  const recipe = await prisma.recipe.upsert({
    where: { userId_externalId_source: { userId, externalId: "seed-protein-bowl", source: "seed" } },
    update: {},
    create: { userId, name: "Protein Bowl", servings: 2, category: "Meal Prep", instructions: "Reis, Hähnchen und Skyr-Dip vorbereiten.", source: "seed", externalId: "seed-protein-bowl" }
  });
  await prisma.recipeItem.deleteMany({ where: { recipeId: recipe.id } });
  await prisma.recipeItem.createMany({ data: [{ recipeId: recipe.id, foodId: foods[3].id, amount: 300 }, { recipeId: recipe.id, foodId: foods[4].id, amount: 300 }, { recipeId: recipe.id, foodId: foods[1].id, amount: 150 }] });

  const existingAiAnalysis = await prisma.aiMealAnalysis.findFirst({ where: { userId, provider: "local", mealType: "LUNCH" } });
  if (!existingAiAnalysis) {
    await prisma.aiMealAnalysis.create({
      data: {
        userId,
        date: startOfDay(new Date()),
        mealType: "LUNCH",
        provider: "local",
        status: "SAVED",
        mode: "REVIEW_REQUIRED",
        confidence: 78,
        totalsJson: JSON.stringify({ calories: 620, protein: 42, carbs: 58, fat: 18, fiber: 6, sugar: 5, salt: 1.2 }),
        items: { create: [{ name: "Protein Bowl", category: "Meal Prep", amount: 1, weightGrams: 420, servingName: "Schüssel", calories: 620, protein: 42, carbs: 58, fat: 18, fiber: 6, sugar: 5, salt: 1.2, confidence: 78, source: "ai_estimate" }] }
      }
    });
  }
}

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
