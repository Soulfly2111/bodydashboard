import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const id = z.string().min(1);
const week = { weekStart: day.describe("Montag als YYYY-MM-DD") };
const version = z.number().int().positive().describe("Version aus get_meal_plan");
const servings = z.number().int().min(1).max(100);
const recipe = z.object({
  name: z.string().min(1), servings, instructions: z.string().optional(), category: z.string().optional(),
  activeMinutes: z.number().int().positive().nullable().optional(),
  ingredients: z.array(z.object({ name: z.string().min(1), amount: z.number().positive(), unit: z.string(), foodId: id.optional() }))
});
const dish = z.object({ servings: servings.optional(), recipeId: id.optional(), leftoverDishId: id.optional(), recipe: recipe.optional() });
const root = "/api/meal-planner";
const plans = (weekStart) => root + "/plans/" + encodeURIComponent(weekStart);
const recipes = (recipeId) => "/api/recipes/" + encodeURIComponent(recipeId);

export function registerMealPlannerTools(server, api, requireKey) {
  const register = (name, description, shape, request) => {
    server.tool(name, description, shape, async (args) => {
      requireKey(name);
      const result = await request(args);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    });
  };
  register("generate_meal_plan", "Erstellt einen Wochenentwurf per Open WebUI oder aus angegebenen Gerichten.", {
    ...week, mode: z.enum(["ai", "manual"]).default("ai"), dishes: z.array(dish).max(14).optional()
  }, ({ weekStart, mode, dishes }) => api(plans(weekStart), { method: "POST", body: { mode, dishes } }));
  register("get_meal_plan", "Liest den sichtbaren Haushaltsplan für einen Montag.", week,
    ({ weekStart }) => api(plans(weekStart)));
  register("replace_meal", "Ersetzt, ergänzt oder entfernt ein Gericht im Entwurf. Im KI-Modus wird eine Alternative vorgeschlagen. Positionen beginnen bei null.", {
    ...week, version, position: z.number().int().min(0).max(13), mode: z.enum(["manual", "ai"]).default("manual"), dish: dish.nullable().optional()
  }, ({ weekStart, ...body }) => api(plans(weekStart) + "/dish", { method: "PUT", body }));
  register("approve_meal_plan", "Gibt einen geprüften Wochenentwurf für den Haushalt frei.", { ...week, version },
    ({ weekStart, ...body }) => api(plans(weekStart) + "/approve", { method: "POST", body }));
  server.registerTool("create_recipe", {
    title: "Rezept im BodyDashboard speichern",
    description: "Speichert ein neues Rezept im Rezeptbuch des verbundenen Kontos. Nutze dieses Werkzeug, wenn der Nutzer ein Rezept speichern möchte. Zutatenmengen gelten für alle angegebenen Portionen. foodId ist optional und darf nur aus der Lebensmittelsuche stammen.",
    inputSchema: recipe.extend({
      shared: z.boolean().default(false).describe("Nur auf ausdrücklichen Wunsch für den Haushalt freigeben.")
    }).shape,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
  }, async (body) => {
    requireKey("create_recipe");
    const { id, name, servings, planning } = await api("/api/recipes", { method: "POST", body });
    const result = { id, name, servings, shared: Boolean(planning?.householdId) };
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  });
  register("get_recipe", "Liest ein sichtbares Rezept mit Kochschritten und Nährwerten.", { recipeId: id },
    ({ recipeId }) => api(recipes(recipeId)));
  register("search_recipes", "Durchsucht eigene und freigegebene Haushaltsrezepte.", { query: z.string().optional(), favorites: z.boolean().default(false) },
    ({ query = "", favorites }) => api("/api/recipes?" + new URLSearchParams({ q: query, favorites: String(favorites) })));
  register("save_favorite_recipe", "Ändert die persönliche Markierung als Lieblingsrezept.", { recipeId: id, favorite: z.boolean().default(true) },
    ({ recipeId, ...body }) => api(recipes(recipeId) + "/feedback", { method: "PUT", body }));
  register("rate_recipe", "Speichert eine persönliche Bewertung von 1 bis 5. Null löscht sie.", { recipeId: id, rating: z.number().int().min(1).max(5).nullable() },
    ({ recipeId, ...body }) => api(recipes(recipeId) + "/feedback", { method: "PUT", body }));
  register("get_meal_history", "Zeigt die eigene Rezept-Verzehrhistorie.", {}, () => api(root + "/consumptions"));
  register("prepare_picnic_cart", "Bereitet die Einkaufsvorschau aus einem freigegebenen Plan vor. Übertragung wird in der PWA bestätigt.", week,
    ({ weekStart }) => api(plans(weekStart) + "/shopping", { method: "POST" }));
  register("get_shopping_status", "Zeigt Einkaufsliste und Status der Übertragung.", week,
    ({ weekStart }) => api(plans(weekStart) + "/shopping"));
  register("log_recipe_consumption", "Erfasst eine gegessene Portion im eigenen Tagebuch. Verwende dieselbe UUID bei Wiederholung desselben Eintrags.", {
    recipeId: id.optional(), dishId: id.optional(), portions: z.number().positive().max(100), date: day,
    type: z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]), requestKey: z.string().uuid()
  }, (body) => api(root + "/consumptions", { method: "POST", body }));
  register("get_meal_preferences", "Liest gemeinsame Einstellungen des eigenen Haushalts.", {}, () => api(root + "/household"));
  register("update_meal_preferences", "Aktualisiert die gemeinsamen Einstellungen als Haushaltsverwaltung.", {
    servings: servings.optional(), dishCount: z.number().int().min(1).max(14).optional(), preferences: z.string().optional(),
    budgetCents: z.number().int().nonnegative().nullable().optional(), autoPlan: z.boolean().optional()
  }, (body) => api(root + "/household", { method: "PUT", body }));
}
