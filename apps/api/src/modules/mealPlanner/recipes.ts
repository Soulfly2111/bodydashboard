import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { addFoodAmount, emptyTotals, roundTotals, type MacroTotals } from "../../utils/nutrition.js";

export const fail = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
export const dbConflict = (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && ["P2002", "P2034", "P2028"].includes(error.code);
export const positive = z.coerce.number().finite().positive().max(100_000);
export const ingredientSchema = z.object({
  name: z.string().trim().min(1).max(160),
  amount: positive,
  unit: z.string().trim().min(1).max(24),
  foodId: z.string().min(1).optional()
}).refine((item) => !item.foodId || ["g", "ml"].includes(item.unit), "Für Nährwerte bitte g oder ml verwenden.");

export const recipeDraftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  servings: z.coerce.number().int().min(1).max(100),
  instructions: z.string().trim().max(12_000).optional(),
  category: z.string().trim().max(80).optional(),
  activeMinutes: z.coerce.number().int().min(1).max(720).nullable().optional(),
  ingredients: z.array(ingredientSchema).max(60)
});
export type RecipeDraft = z.infer<typeof recipeDraftSchema>;
export type Snapshot = Omit<RecipeDraft, "ingredients"> & {
  ingredients: Array<Omit<z.infer<typeof ingredientSchema>, "foodId"> & { hasNutrition: boolean }>;
  perPortion: MacroTotals | null;
  trackedWeightPerPortion: number | null;
};
const includeRecipe = {
  planning: true,
  items: { include: { food: true } }
} satisfies Prisma.RecipeInclude;
type RecipeRecord = Prisma.RecipeGetPayload<{ include: typeof includeRecipe }>;

export async function membership(userId: string) {
  return prisma.mealHouseholdMember.findUnique({ where: { userId }, include: { household: true } });
}

function visibility(userId: string, householdId?: string): Prisma.RecipeWhereInput {
  return { OR: [{ userId }, ...(householdId ? [{ planning: { householdId } }] : [])] };
}

export async function recipeFor(userId: string, id: string, householdId?: string) {
  const recipe = await prisma.recipe.findFirst({ where: { id, ...visibility(userId, householdId) }, include: includeRecipe });
  if (!recipe) throw fail(404, "Rezept nicht gefunden.");
  return recipe;
}

export function recipeSnapshot(recipe: RecipeRecord): Snapshot {
  const ingredients = recipe.planning?.ingredients
    ? JSON.parse(recipe.planning.ingredients) as RecipeDraft["ingredients"]
    : recipe.items.map(({ food, amount, unit }) => ({ name: food.name, foodId: food.id, amount, unit }));
  const foods = new Map(recipe.items.map(({ food }) => [food.id, food]));
  return snapshotFor({
    name: recipe.name,
    servings: recipe.servings,
    instructions: recipe.instructions ?? undefined,
    category: recipe.category ?? undefined,
    activeMinutes: recipe.planning?.activeMinutes
  }, ingredients, foods);
}

function snapshotFor(
  details: Omit<RecipeDraft, "ingredients">,
  ingredients: RecipeDraft["ingredients"],
  foods: ReadonlyMap<string, RecipeRecord["items"][number]["food"]>
): Snapshot {
  const totals = emptyTotals();
  let weight = 0;
  const rows = ingredients.map(({ name, amount, unit, foodId }) => {
    const food = foodId && ["g", "ml"].includes(unit) ? foods.get(foodId) : undefined;
    if (food) {
      addFoodAmount(totals, food, amount);
      weight += amount;
    }
    return { name, amount, unit, hasNutrition: Boolean(food) };
  });
  const complete = rows.length > 0 && rows.every((row) => row.hasNutrition);
  const perPortion = emptyTotals();
  for (const key of Object.keys(perPortion) as Array<keyof MacroTotals>) perPortion[key] = totals[key] / details.servings;
  return { ...details, ingredients: rows, perPortion: complete ? perPortion : null, trackedWeightPerPortion: complete ? weight / details.servings : null };
}

async function ingredientFoods(userId: string, ingredients: RecipeDraft["ingredients"]) {
  const ids = [...new Set(ingredients.flatMap((item) => item.foodId ? [item.foodId] : []))];
  const foods = await prisma.food.findMany({ where: { id: { in: ids }, OR: [{ userId }, { isPublic: true }], source: { not: "recipe_consumption" } } });
  if (foods.length !== ids.length) throw fail(400, "Mindestens ein Lebensmittel ist nicht verfügbar.");
  return new Map(foods.map((food) => [food.id, food]));
}

export async function snapshotDraft(userId: string, draft: RecipeDraft) {
  const { ingredients, ...details } = draft;
  return snapshotFor(details, ingredients, await ingredientFoods(userId, ingredients));
}

export async function listRecipes(userId: string, query = "", favorites = false, id?: string) {
  const member = await membership(userId);
  const recipes = await prisma.recipe.findMany({
    where: { ...visibility(userId, member?.householdId), id, ...(query ? { name: { contains: query } } : {}),
      ...(favorites ? { feedback: { some: { userId, favorite: true } } } : {}) },
    include: { ...includeRecipe, feedback: { where: { userId } } },
    orderBy: { name: "asc" }
  });
  return recipes.map((recipe) => {
    const snapshot = recipeSnapshot(recipe);
    const { planning, feedback, items, ...data } = recipe;
    return {
      ...data, ...snapshot, id: recipe.id, owned: recipe.userId === userId, shared: Boolean(planning?.householdId),
      ingredients: snapshot.ingredients.map((row, index) => ({
        ...row, ...(recipe.userId === userId ? { foodId: planning?.ingredients
          ? (JSON.parse(planning.ingredients) as RecipeDraft["ingredients"])[index]?.foodId : items[index]?.foodId } : {})
      })),
      items: recipe.userId === userId ? items : [],
      totals: roundTotals(items.reduce((totals, item) => addFoodAmount(totals, item.food, item.amount), emptyTotals())),
      favorite: feedback[0]?.favorite ?? false, rating: feedback[0]?.rating ?? null
    };
  });
}

const writeSchema = recipeDraftSchema.partial({ ingredients: true }).extend({
  servings: recipeDraftSchema.shape.servings.default(1),
  shared: z.boolean().default(false),
  items: z.array(z.object({ foodId: z.string().min(1), amount: positive, unit: z.string().default("g") })).optional()
});

export async function writeRecipe(userId: string, input: unknown, id?: string) {
  const { items, ingredients, shared, activeMinutes, ...details } = writeSchema.parse(input);
  const legacyFoods = items ? await ingredientFoods(userId, items.map((item) => ({ ...item, name: item.foodId }))) : undefined;
  const rows = ingredients ?? items?.map((item) => ({ ...item, name: legacyFoods!.get(item.foodId)!.name })) ?? [];
  await ingredientFoods(userId, rows);
  const member = shared ? await membership(userId) : null;
  if (shared && !member) throw fail(400, "Ein Haushalt ist für die Freigabe erforderlich.");
  const planning = { ingredients: JSON.stringify(rows), activeMinutes: activeMinutes ?? null, householdId: member?.householdId ?? null };
  const linked = rows.flatMap(({ foodId, amount, unit }) => foodId ? [{ foodId, amount, unit }] : []);
  if (!id) {
    return prisma.recipe.create({ data: { ...details, userId, items: { create: linked }, planning: { create: planning } }, include: includeRecipe });
  }
  return prisma.$transaction(async (tx) => {
    const owned = await tx.recipe.findFirst({ where: { id, userId }, select: { id: true } });
    if (!owned) throw fail(404, "Rezept nicht gefunden.");
    return tx.recipe.update({
      where: { id }, data: { ...details, items: { deleteMany: {}, create: linked }, planning: { upsert: { create: planning, update: planning } } },
      include: includeRecipe
    });
  });
}

export async function createSharedPlanRecipe(tx: Prisma.TransactionClient, userId: string, householdId: string, draft: RecipeDraft) {
  const { ingredients, activeMinutes, ...details } = draft;
  const ids = ingredients.flatMap((item) => item.foodId ? [item.foodId] : []);
  const available = await tx.food.findMany({
    where: { id: { in: ids }, OR: [{ userId }, { isPublic: true }], source: { not: "recipe_consumption" } },
    select: { id: true }
  });
  const allowed = new Set(available.map(({ id }) => id));
  const rows = ingredients.map((item) => ({ ...item, foodId: item.foodId && allowed.has(item.foodId) ? item.foodId : undefined }));
  const items = rows.flatMap(({ foodId, amount, unit }) => foodId ? [{ foodId, amount, unit }] : []);
  return tx.recipe.create({
    data: {
      userId, source: "meal_planner", ...details, items: { create: items },
      planning: { create: { householdId, activeMinutes, ingredients: JSON.stringify(rows) } }
    },
    select: { id: true }
  });
}

export async function recipeFeedback(userId: string, id: string, input: unknown) {
  const changes = z.object({ favorite: z.boolean().optional(), rating: z.number().int().min(1).max(5).nullable().optional() }).parse(input);
  await recipeFor(userId, id, (await membership(userId))?.householdId);
  return prisma.recipeFeedback.upsert({
    where: { recipeId_userId: { recipeId: id, userId } }, create: { recipeId: id, userId, ...changes }, update: changes
  });
}
