import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { startMealPlannerWorker } from "./modules/mealPlanner/automation.js";
import { logger } from "./config/logger.js";

createApp().listen(env.PORT, () => {
  startMealPlannerWorker();
  logger.info(`API listening on http://localhost:${env.PORT}`);
});
