import { expect, test } from "@playwright/test";

test("GET /api/health responds ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBe(true);
  expect(await res.json()).toEqual({ status: "ok" });
});

test("home page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Rummikub scores" })).toBeVisible();
});
