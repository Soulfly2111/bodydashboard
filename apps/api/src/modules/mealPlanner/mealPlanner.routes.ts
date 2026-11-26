import { Router, type Request, type Response } from "express";
import { requireMealPlannerAuth } from "../../middleware/auth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { jobView, readDishImage, retryJob } from "./automation.js";
import { consumptionHistory, previewPortion, recordConsumption } from "./consumption.js";
import { acceptInvitation, createHousehold, householdView, inviteMember, removeMember, revokeInvitation, updatePreferences } from "./households.js";
import { confirmCooked, pantryView, removePantryItem, savePantryItem } from "./pantry.js";
import { approvePlan, generatePlan, recommendations, replaceDish, viewPlan } from "./plans.js";
import { plannerScope } from "./scope.js";
import { editShopping, findProducts, getShopping, prepareShopping, queueCart, refreshShopping } from "./shopping.js";

export const mealPlannerRouter = Router();
mealPlannerRouter.use(requireMealPlannerAuth);
const read = plannerScope("read");
const write = plannerScope("write");
const browser = plannerScope("browser");

const send = (action: (req: Request) => Promise<unknown>) => asyncHandler(async (req, res) => res.json(await action(req)));
const empty = (action: (req: Request) => Promise<unknown>) => asyncHandler(async (req, res) => {
  await action(req);
  res.status(204).end();
});
const user = (req: Request) => req.user!.id;
const week = (req: Request) => req.params.week;

mealPlannerRouter.get("/household", read, send((req) => householdView(user(req))));
mealPlannerRouter.post("/household", browser, send((req) => createHousehold(user(req), req.body)));
mealPlannerRouter.put("/household", write, send((req) => updatePreferences(user(req), req.body)));
mealPlannerRouter.post("/household/invites", browser, send((req) => inviteMember(user(req))));
mealPlannerRouter.delete("/household/invites/:id", browser, empty((req) => revokeInvitation(user(req), req.params.id)));
mealPlannerRouter.post("/household/join", browser, send((req) => acceptInvitation(user(req), req.body)));
mealPlannerRouter.delete("/household/members/:id", browser, empty((req) => removeMember(user(req), req.params.id)));

mealPlannerRouter.get("/plans/:week", read, send((req) => viewPlan(user(req), week(req))));
mealPlannerRouter.post("/plans/:week", write, send((req) => generatePlan(user(req), week(req), req.body)));
mealPlannerRouter.put("/plans/:week/dish", write, send((req) => replaceDish(user(req), week(req), req.body)));
mealPlannerRouter.post("/plans/:week/approve", write, send((req) => approvePlan(user(req), week(req), req.body)));
mealPlannerRouter.get("/recommendations", read, send((req) => recommendations(user(req), req.query.week)));

mealPlannerRouter.post("/preview", read, send((req) => previewPortion(user(req), req.body)));
mealPlannerRouter.post("/consumptions", write, send((req) => recordConsumption(user(req), req.body)));
mealPlannerRouter.get("/consumptions", read, send((req) => consumptionHistory(user(req))));

mealPlannerRouter.get("/jobs", browser, send((req) => jobView(user(req))));
mealPlannerRouter.post("/jobs/:id/retry", browser, empty((req) => retryJob(user(req), req.params.id)));

mealPlannerRouter.get("/plans/:week/shopping", read, send((req) => getShopping(user(req), week(req))));
mealPlannerRouter.post("/plans/:week/shopping", write, send((req) => prepareShopping(user(req), week(req))));
mealPlannerRouter.put("/plans/:week/shopping", write, send((req) => editShopping(user(req), week(req), req.body)));
mealPlannerRouter.post("/plans/:week/shopping/refresh", browser, send((req) => refreshShopping(user(req), week(req), req.body)));
mealPlannerRouter.get("/plans/:week/shopping/products", browser, send((req) => findProducts(user(req), week(req), req.query.q)));
mealPlannerRouter.post("/plans/:week/shopping/confirm", browser, send((req) => queueCart(user(req), week(req), req.body)));

mealPlannerRouter.get("/pantry", read, send((req) => pantryView(user(req))));
mealPlannerRouter.post("/pantry", write, send((req) => savePantryItem(user(req), req.body)));
mealPlannerRouter.put("/pantry/:id", write, send((req) => savePantryItem(user(req), req.body, req.params.id)));
mealPlannerRouter.delete("/pantry/:id", write, empty((req) => removePantryItem(user(req), req.params.id)));
mealPlannerRouter.post("/dishes/:id/cooked", write, send((req) => confirmCooked(user(req), req.params.id, req.body)));
mealPlannerRouter.get("/dishes/:id/images/:index", read, asyncHandler(async (req: Request, res: Response) => {
  const image = await readDishImage(user(req), req.params.id, req.params.index);
  res.setHeader("Cache-Control", "private, no-store");
  res.type(image.mediaType).send(image.contents);
}));
