import { test } from "./test-base";

test.describe("User Management", () => {
  test("should track user listing and creation", async ({ page }) => {
    await page.goto("/");

    // Multiple list calls
    for (let i = 0; i < 4; i++) {
      const p = page.waitForResponse("**/api/users/list");
      await page.evaluate(() => fetch("/api/users/list"));
      await p;
    }

    const p2 = page.waitForResponse("**/api/users/create");
    await page.evaluate(() => fetch("/api/users/create", { method: "POST" }));
    await p2;
  });

  test("should track individual user fetching", async ({ page, waitReady }) => {
    await page.goto("/");

    for (const id of [1, 2, 3, 4, 5]) {
      const p = page.waitForResponse(`**/api/users/${id}`);
      await page.evaluate((i) => fetch(`/api/users/${i}`), id);
      await p;
    }

    await page.click("#btn-fast");
    await waitReady();
    await page.click("#btn-slow");
    await waitReady();
  });
});
