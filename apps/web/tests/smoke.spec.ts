import { expect, test } from "@playwright/test";

test("renders login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Bodydashboard")).toBeVisible();
});
