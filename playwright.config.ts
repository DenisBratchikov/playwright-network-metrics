import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./test",
  testMatch: "integration.spec.ts",
  use: {
    baseURL: "http://localhost:3456",
  },
  reporter: [
    ["list"],
    ["./src/reporter.ts", { outDir: "test-report", html: true }],
  ],
});
