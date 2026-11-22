import { test, expect } from "@playwright/test";

const supplements = [{ id: "creatin", name: "Creatin", color: "#00baff" }, { id: "kollagen", name: "Kollagen", color: "#ffffff" }, { id: "lavita", name: "LaVita", color: "#32ff20" }];
const totals = { calories: 2198.2, protein: 166.3, fat: 60, carbs: 245.1, hasNutrition: true, knownNutrition: { calories: true, protein: true, fat: true, carbs: true }, missingNutritionCount: 0 };
const data = { today: "2026-11-19", timezone: "Europe/Berlin", supplements,
  days: Array.from({ length: 7 }, (_, i) => ({ ...totals, date: `2026-11-${19-i}`, activityCount: i % 2, supplements: supplements.map(s => ({ id: s.id, count: i < 4 ? 1 : 0 })), ...(i > 3 ? { hasNutrition: false } : {}) })),
  weeks: Array.from({ length: 4 }, (_, i) => ({ ...totals, start: ["2026-11-13","2026-11-06","2026-10-30","2026-10-23"][i], end: ["2026-11-19","2026-11-12","2026-11-05","2026-10-29"][i], weightKg: i ? null : 93.2, bodyFatPercent: i ? null : 26.6, supplements: supplements.map(s => ({ id: s.id, days: i ? 0 : 4 })), ...(i ? { hasNutrition: false } : {}) })) };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("macroflow.token", "test-token");
    localStorage.setItem("macroflow.user", JSON.stringify({ id: "test", name: "Test", role: "USER" }));
  });
  await page.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    const body = path === "/api/stats/overview" ? data : path === "/api/auth/me" ? { id: "test", name: "Test", role: "USER", timezone: "Europe/Berlin" } : [];
    await route.fulfill({ json: body });
  });
});

test("default overview renders periods, accessible activity lights and preserved detail link", async ({ page }, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Letzte 7 Tage" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Letzte 4 Wochen" })).toBeVisible();
  await expect(page.getByRole("img", { name: "1 Aktivitäten erfasst" }).first()).toBeVisible();
  await expect(page.getByText("13.11.–19.11.")).toBeVisible();
  await expect(page.getByRole("link", { name: /Detailansicht/ })).toHaveAttribute("href", "/dashboard-details");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("overview.png"), fullPage: true });
});

test("supplement form preserves unknown nutrition and saves a product", async ({ page }) => {
  let posted: unknown;
  await page.route("**/api/supplements**", async route => {
    if (route.request().method() === "POST") { posted = route.request().postDataJSON(); await route.fulfill({ json: { id: "new", ...(posted as object) } }); }
    else await route.fulfill({ json: route.request().url().includes("/new") ? { id: "new", name: "Magnesium", unit: "Stück", entries: [] } : [] });
  });
  await page.goto("/supplements");
  await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Magnesium");
  await page.getByLabel("Einheit", { exact: true }).selectOption("Stück");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Magnesium", exact: true })).toBeVisible();
  expect(posted).toMatchObject({ name: "Magnesium", unit: "Stück", calories: null, defaultAmount: null });
});

test("a slow product list does not close the new supplement form", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/supplements?archived=true", async route => {
    await pending;
    await route.fulfill({ json: [] });
  });
  await page.goto("/supplements");
  await page.getByRole("button", { name: "Hinzufügen", exact: true }).click();
  const completed = page.waitForResponse("**/api/supplements?archived=true");
  release();
  await completed;
  await page.getByLabel("Name", { exact: true }).fill("Magnesium");
  await expect(page.getByRole("heading", { name: "Supplement hinzufügen" })).toBeVisible();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Magnesium");
});
test("Geise dashboard selects days and redirects other pages", async ({page},info)=>{
 await page.setViewportSize({width:360,height:800});
 await page.addInitScript(()=>localStorage.setItem("macroflow.user",JSON.stringify({id:"cmwqmmgy800yumojcmtbe7796",name:"Geise",role:"USER"})));
 await page.route("**/api/stats/day/*",route=>route.fulfill({json:{goal:{calories:2000,protein:150,fat:70,carbs:200},missingNutritionCount:0,latestMeasurements:{weight:{date:"2026-10-01",weightKg:68.7},bodyFat:{date:"2026-09-01",bodyFatPercent:24.2}},meals:[{type:"BREAKFAST",items:[{id:"a",name:route.request().url().endsWith("19")?"Apfel":"Banane",amount:125.4,unit:"g"}]}]}}));
 await page.goto("/settings");
 await expect(page).toHaveURL("/");
 await expect(page.getByText("Apfel",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"18.11. auswählen",exact:true}).click();
 await expect(page.getByText("Banane",{exact:true})).toBeVisible();
 await expect(page.getByText("Apfel",{exact:true})).toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.locator("section").last()).toHaveClass(/g-history/);
 await page.screenshot({path:info.outputPath("geise.png"),fullPage:true});
});
