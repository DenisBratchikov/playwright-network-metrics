import { test as base, expect, type Fixtures } from "@playwright/test";
import { defineNetworkMetricsFixture } from "../src/index";

export const test = base.extend<{
  waitReady: () => Promise<void>;
  networkMetrics: Fixtures;
}>({
  waitReady: async ({ page }, use) => {
    await use(async () => {
      await expect(page.locator("#status")).toHaveText("Ready", {
        timeout: 10000,
      });
    });
  },
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

export { expect };
