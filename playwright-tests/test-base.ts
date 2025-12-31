import { test as base, expect, type Fixtures } from "@playwright/test";
import { defineNetworkMetricsFixture } from "../src/index";

export const test = base
  .extend<{ waitReady: () => Promise<void>; networkMetrics: Fixtures }>({
    waitReady: async ({ page }, use) => {
      await use(async () => {
        await expect(page.locator("#status")).toHaveText("Ready", {
          timeout: 10000,
        });
      });
    },
  })
  .extend({
    networkMetrics: defineNetworkMetricsFixture({
      urlMatch: "**" + "/api/" + "**",
      redactQueryParams: ["token", "secret"],
      routeGroupRules: [
        { match: "**" + "/api/users/*", group: "UserManagement" },
        { match: "**" + "/api/auth/*", group: "Authentication" },
        { match: "**" + "/api/random*", group: "RandomAPI" },
      ],
    }),
  });

test.beforeEach(async ({ page }) => {
  // Common mocks
  await page.route("**/api/fast", async (route) => {
    await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  });

  await page.route("**/api/slow", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 200));
    await route.fulfill({ status: 200, body: JSON.stringify({ ok: true }) });
  });

  await page.route("**/api/random?time=*", async (route) => {
    const url = new URL(route.request().url());
    const time = parseInt(url.searchParams.get("time") || "0", 10);
    await new Promise((resolve) => setTimeout(resolve, time));
    await route.fulfill({
      status: 200,
      body: JSON.stringify({ delayed: time }),
    });
  });

  await page.route("**/api/random?status=*", async (route) => {
    const url = new URL(route.request().url());
    const status = url.searchParams.get("status");
    if (status === "error") {
      await route.fulfill({ status: 500, body: "Error" });
    } else {
      await route.fulfill({ status: 200, body: "Success" });
    }
  });
});

export { expect };
