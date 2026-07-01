import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type Food } from "@prisma/client";
import { startOfDay, subDays } from "date-fns";

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

  await prisma.auditLog.createMany({
    data: [
      { userId: admin.id, actorUserId: admin.id, action: "seed.admin_created", entityType: "User", entityId: admin.id },
      { userId: christoph.id, actorUserId: admin.id, action: "seed.user_created", entityType: "User", entityId: christoph.id }
    ]
  });

  await seedChristophData(christoph.id);
}

async function removeLegacyDemoUser() {
  await prisma.user.deleteMany({ where: { email: "demo@example.com" } });
}

async function upsertUser(input: { username: string; email: string; name: string; firstName: string; password: string; role: string }) {
  const passwordHash = await bcrypt.hash(input.password, 12);
  return prisma.user.upsert({
    where: { email: input.email },
    update: { username: input.username, role: input.role, status: "ACTIVE", passwordHash },
    create: {
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

  await prisma.favorite.upsert({ where: { userId_type_targetId: { userId, type: "FOOD", targetId: foods[1].id } }, update: { label: foods[1].name }, create: { userId, type: "FOOD", targetId: foods[1].id, label: foods[1].name } });

  const recipe = await prisma.recipe.upsert({
    where: { userId_externalId_source: { userId, externalId: "seed-protein-bowl", source: "seed" } },
    update: {},
    create: { userId, name: "Protein Bowl", servings: 2, category: "Meal Prep", instructions: "Reis, Hähnchen und Skyr-Dip vorbereiten.", source: "seed", externalId: "seed-protein-bowl" }
  });
  await prisma.recipeItem.deleteMany({ where: { recipeId: recipe.id } });
  await prisma.recipeItem.createMany({ data: [{ recipeId: recipe.id, foodId: foods[3].id, amount: 300 }, { recipeId: recipe.id, foodId: foods[4].id, amount: 300 }, { recipeId: recipe.id, foodId: foods[1].id, amount: 150 }] });

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

main()
  .finally(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
