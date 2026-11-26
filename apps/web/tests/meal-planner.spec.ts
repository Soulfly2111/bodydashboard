import { expect, test } from "@playwright/test";

test.use({ serviceWorkers: "block" });

test("reviews a weekly draft and records a fractional portion", async ({ page }) => {
  const week = "/api/meal-planner/plans/2026-11-30";
  const recipe = {
    name: "Linsen mit Gemüse", servings: 4, instructions: "Linsen kochen.", activeMinutes: 30,
    ingredients: [{ name: "Linsen", amount: 400, unit: "g", hasNutrition: true }],
    perPortion: { calories: 130, protein: 10, carbs: 21, fat: 1 }
  };
  const dish = { id: "first", position: 0, servings: 4, recipe, recipeId: "recipe", images: null, cookedAt: null, leftoverPortions: 0 };
  let plan: { id: string; weekStart: string; status: string; version: number; dishes: typeof dish[] } | null = null;
  let consumption: Record<string, unknown> | null = null;

  await page.addInitScript(() => {
    localStorage.setItem("macroflow.user", JSON.stringify({ id: "owner", name: "Planung", email: "test@example.invalid", role: "USER", status: "ACTIVE" }));
    localStorage.setItem("macroflow.token", "browser-fixture");
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const method = route.request().method();
    const send = (json: unknown) => route.fulfill({ json });
    if (path === "/api/meal-planner/household") return send({
      id: "house", name: "Familie", role: "owner", servings: 4, dishCount: 3, preferences: "Pflanzlich",
      budgetCents: null, autoPlan: false, invitations: [], members: [{ userId: "owner", role: "owner", user: { name: "Planung" } }]
    });
    if (path === week && method === "GET") return send(plan);
    if (path === week && method === "POST") {
      expect(route.request().postDataJSON()).toEqual({ mode: "ai" });
      plan = { id: "plan", weekStart: "2026-11-30", status: "draft", version: 1, dishes: [dish] };
      return send(plan);
    }
    if (path === week + "/dish") {
      expect(route.request().postDataJSON()).toEqual({ position: 0, version: 1, dish: { recipeId: "recipe", servings: 6 } });
      plan = { ...plan!, version: 2, dishes: [{ ...dish, servings: 6 }] };
      return send(plan);
    }
    if (path === week + "/approve") {
      expect(route.request().postDataJSON()).toEqual({ version: 2 });
      plan = { ...plan!, status: "approved", version: 3 };
      return send(plan);
    }
    if (path === "/api/meal-planner/recommendations") return send({ recipes: [{ id: "recipe", name: recipe.name, reason: "Favorit" }], leftovers: [] });
    if (path === "/api/meal-planner/preview") {
      const { portions } = route.request().postDataJSON() as { portions: number };
      return send({ name: recipe.name, totals: { calories: 130 * portions, protein: 10 * portions, fat: portions, carbs: 21 * portions }, goal: null });
    }
    if (path === "/api/meal-planner/consumptions" && method === "POST") {
      consumption = route.request().postDataJSON();
      return send({ id: "consumption", mealItemId: "booked" });
    }
    if (path === week + "/shopping") return send(null);
    if (["/api/meal-planner/jobs", "/api/meal-planner/pantry", "/api/meal-planner/consumptions", "/api/foods", "/api/favorites/foods"].includes(path)) return send([]);
    if (path === "/api/meals/day/2026-12-01") return send([{ id: "meal", type: "DINNER", items: [{
      id: "booked", servingName: "0.5 Portion(en)", amount: 50, food: { id: "food", source: "recipe_consumption", name: recipe.name, caloriesPer100g: 130, protein: 10, fat: 1, carbs: 21 }
    }] }]);
    return route.fulfill({ status: 404, json: { error: "Unerwartete Testanfrage " + path } });
  });

  await page.goto("/meal-planner?week=2026-11-30");
  await page.getByRole("button", { name: "Mit Open WebUI planen" }).click();
  await expect(page.getByRole("heading", { name: "Wochenplan im Entwurf" })).toBeVisible();
  await page.getByRole("button", { name: "Gericht ändern" }).click();
  await page.getByLabel("Geplante Portionen").fill("6");
  await page.getByRole("button", { name: "Gericht speichern" }).click();
  await expect(page.getByText("1 Gericht · 6 Portionen")).toBeVisible();
  await page.getByRole("button", { name: "Wochenplan freigeben" }).click();
  await expect(page.getByRole("heading", { name: "Wochenplan freigegeben" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Portionen", exact: true }).fill("0.5");
  await page.getByLabel("Datum", { exact: true }).fill("2026-12-01");
  await expect(page.getByText(/^65 kcal · 5 g Protein/)).toBeVisible();
  await page.getByRole("button", { name: "Ins Ernährungstagebuch übernehmen" }).click();
  await page.getByRole("link", { name: "Tagebuch öffnen" }).click();
  await expect(page.getByText("Linsen mit Gemüse · 0.5 Portion(en) · 65 kcal")).toBeVisible();
  expect(consumption).toMatchObject({ dishId: "first", date: "2026-12-01", type: "DINNER", portions: 0.5, requestKey: expect.any(String) });
});
