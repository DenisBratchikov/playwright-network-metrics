import { test, expect } from "./test-base";

test.describe("Product Inventory", () => {
  test("should track search and details", async ({ page }) => {
    await page.goto("/");

    await page.route("**/api/products/search?q=*", (route) =>
      route.fulfill({ status: 200 })
    );

    for (const q of ["laptop", "phone", "tablet", "monitor"]) {
      const p = page.waitForResponse((r) =>
        r.url().includes(`/api/products/search?q=${q}`)
      );
      await page.evaluate((term) => fetch(`/api/products/search?q=${term}`), q);
      await p;
    }

    await page.route("**/api/products/details/*", (route) =>
      route.fulfill({ status: 200 })
    );
    for (const id of [101, 102, 103]) {
      const p = page.waitForResponse(`**/api/products/details/${id}`);
      await page.evaluate((i) => fetch(`/api/products/details/${i}`), id);
      await p;
    }
  });

  test("should track inventory updates", async ({ page, waitReady }) => {
    await page.goto("/");

    await page.route("**/api/products/update", (route) =>
      route.fulfill({ status: 200 })
    );

    for (let i = 0; i < 5; i++) {
      const p = page.waitForResponse("**/api/products/update");
      await page.evaluate(() =>
        fetch("/api/products/update", { method: "PUT" })
      );
      await p;
    }

    for (let i = 0; i < 5; i++) {
      const p = page.waitForResponse((r) =>
        r.url().includes("/api/random?time=")
      );
      await page.click("#btn-random-time");
      await p;
      await waitReady();
    }
  });
});
