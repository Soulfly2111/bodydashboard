import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { errorMiddleware } from "./middleware/error.js";
import { aiMealsRouter } from "./modules/aiMeals/aiMeals.routes.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { favoritesRouter } from "./modules/favorites/favorites.routes.js";
import { foodsRouter } from "./modules/foods/foods.routes.js";
import { goalsRouter } from "./modules/goals/goals.routes.js";
import { importRouter } from "./modules/import/import.routes.js";
import { mealsRouter } from "./modules/meals/meals.routes.js";
import { openFoodFactsRouter } from "./modules/openFoodFacts/openFoodFacts.routes.js";
import { recipesRouter } from "./modules/recipes/recipes.routes.js";
import { statsRouter } from "./modules/stats/stats.routes.js";
import { waterRouter } from "./modules/water/water.routes.js";
import { weightRouter } from "./modules/weight/weight.routes.js";

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "12mb" }));
  app.use(pinoHttp({ logger }));
  app.use(rateLimit({ windowMs: 60_000, limit: 120 }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);
  app.use("/api", authRouter);
  app.use("/api/foods", foodsRouter);
  app.use("/api/meals", mealsRouter);
  app.use("/api/recipes", recipesRouter);
  app.use("/api/weight", weightRouter);
  app.use("/api/water", waterRouter);
  app.use("/api/goals", goalsRouter);
  app.use("/api/favorites", favoritesRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/import-sources", importRouter);
  app.use("/api/open-food-facts", openFoodFactsRouter);
  app.use("/api/ai-meals", aiMealsRouter);
  app.use(errorMiddleware);
  return app;
}
