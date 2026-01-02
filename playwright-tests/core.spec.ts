import { test } from "./test-base";

test.describe("Core Functionality", () => {
  test("should track static assets", async ({ page }) => {
    // Wait for assets to ensure they are captured
    const assets = [
      "**/style.css",
      "**/script.js",
      "**/image.png",
      "**/font.woff2",
    ];
    const promises = assets.map((u) => page.waitForResponse(u));
    await page.goto("/");
    await Promise.all(promises);
  });

  test("should handle basic repetitive calls", async ({ page, waitReady }) => {
    await page.goto("/");

    // Call fast API 5 times
    for (let i = 0; i < 5; i++) {
      const responsePromise = page.waitForResponse("**/api/fast");
      await page.click("#btn-fast");
      await responsePromise;
      await waitReady();
    }

    // Call error API 3 times
    for (let i = 0; i < 3; i++) {
      const responsePromise = page.waitForResponse("**/api/error");
      await page.click("#btn-error");
      await responsePromise;
      await waitReady();
    }
  });

  test("should handle randomized timing", async ({ page, waitReady }) => {
    await page.goto("/");

    // Trigger 5 random time calls
    for (let i = 0; i < 5; i++) {
      const responsePromise = page.waitForResponse((r) =>
        r.url().includes("/api/random?time=")
      );
      await page.click("#btn-random-time");
      await responsePromise;
      await waitReady();
    }
  });
});
