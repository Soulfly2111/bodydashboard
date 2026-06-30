import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { startOfDay, subDays } from "date-fns";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("DemoPassword123!", 12);
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      email: "demo@example.com",
      name: "Demo User",
      passwordHash,
      heightCm: 180,
      goal: { create: { calories: 2200, protein: 150, carbs: 240, fat: 70, waterMl: 2800, weightKg: 78 } }
    }
  });

  const foods = [
    { name: "Haferflocken", brand: "Basis", category: "Getreide", caloriesPer100g: 370, protein: 13, carbs: 60, fat: 7, fiber: 10, sugar: 1, salt: 0.02 },
    { name: "Skyr Natur", brand: "Nordic Dairy", category: "Milchprodukte", caloriesPer100g: 63, protein: 11, carbs: 4, fat: 0.2, fiber: 0, sugar: 4, salt: 0.1 },
    { name: "Banane", brand: "Frisch", category: "Obst", caloriesPer100g: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, sugar: 12, salt: 0 },
    { name: "Hähnchenbrust", brand: "Metzger", category: "Fleisch", caloriesPer100g: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, sugar: 0, salt: 0.18 },
    { name: "Reis gekocht", brand: "Basis", category: "Beilage", caloriesPer100g: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, salt: 0.01 }
  ];

  const createdFoods = [];
  for (const food of foods) {
    createdFoods.push(
      await prisma.food.upsert({
        where: { userId_externalId_source: { userId: user.id, externalId: food.name, source: "seed" } },
        update: food,
        create: { ...food, userId: user.id, externalId: food.name, source: "seed", isPublic: false }
      })
    );
  }

  const breakfast = await prisma.meal.upsert({
    where: { userId_date_type: { userId: user.id, date: startOfDay(new Date()), type: "BREAKFAST" } },
    update: {},
    create: { userId: user.id, date: startOfDay(new Date()), type: "BREAKFAST" }
  });

  await prisma.mealItem.deleteMany({ where: { mealId: breakfast.id } });
  await prisma.mealItem.createMany({
    data: [
      { mealId: breakfast.id, foodId: createdFoods[0].id, amount: 70, unit: "g" },
      { mealId: breakfast.id, foodId: createdFoods[1].id, amount: 250, unit: "g" },
      { mealId: breakfast.id, foodId: createdFoods[2].id, amount: 120, unit: "g" }
    ]
  });

  for (let i = 0; i < 30; i += 1) {
    await prisma.weightEntry.upsert({
      where: { userId_date: { userId: user.id, date: startOfDay(subDays(new Date(), i)) } },
      update: { weightKg: 80 - i * 0.04 },
      create: { userId: user.id, date: startOfDay(subDays(new Date(), i)), weightKg: 80 - i * 0.04 }
    });
  }

  await prisma.waterEntry.createMany({
    data: [
      { userId: user.id, date: startOfDay(new Date()), amountMl: 500 },
      { userId: user.id, date: startOfDay(new Date()), amountMl: 750 }
    ]
  });
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
