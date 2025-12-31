import { test } from "./test-base";

test.describe("Authentication Flows", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({
        status: 200,
        body: JSON.stringify({ token: "secret-token" }),
      }),
    );
    await page.route("**/api/auth/logout", (route) =>
      route.fulfill({ status: 204 }),
    );
  });

  test("should track login and logout metrics", async ({ page, waitReady }) => {
    await page.goto("/");

    // Simulate login calls
    for (const user of ["user1", "user2"]) {
      const responsePromise = page.waitForResponse((r) =>
        r.url().includes(`/api/auth/login?token=${user}`),
      );
      await page.evaluate(
        (u) => fetch(`/api/auth/login?token=${u}`, { method: "POST" }),
        user,
      );
      await responsePromise;
    }

    // Simulate logout
    const logoutPromise = page.waitForResponse("**/api/auth/logout");
    await page.evaluate(() => fetch("/api/auth/logout"));
    await logoutPromise;

    // Check random status
    for (let i = 0; i < 4; i++) {
      const responsePromise = page.waitForResponse((r) =>
        r.url().includes("/api/random?status="),
      );
      await page.click("#btn-random-status");
      await responsePromise;
      await waitReady();
    }
  });

  test("should handle failed auth attempts", async ({ page }) => {
    await page.goto("/");
    await page.route("**/api/auth/login", (route) =>
      route.fulfill({ status: 401 }),
    );

    for (let i = 0; i < 3; i++) {
      const responsePromise = page.waitForResponse("**/api/auth/login");
      await page.evaluate(() => fetch("/api/auth/login"));
      await responsePromise;
    }
  });
});
