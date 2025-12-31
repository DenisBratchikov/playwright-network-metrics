# playwright-network-metrics

[![npm version](https://img.shields.io/npm/v/playwright-network-metrics.svg)](https://www.npmjs.com/package/playwright-network-metrics)

A Playwright instrumentation package that collects and aggregates network performance metrics across your entire test run.

## Features

- **Native Timings**: Uses standard Playwright `request.timing()` for accurate measurement.
- **Interactive HTML Report**: Visualizes network performance with charts and detailed tables.
- **Granular Aggregation**: Groups by normalized URL, exact URL, resource type, and custom route groups.
- **Low Overhead**: Captures only necessary metadata, avoiding request/response body storage.
- **Flexible Filtering**: Use glob patterns to focus on specific APIs or resource types.

## Installation

```bash
npm install --save-dev playwright-network-metrics
```

## Usage

### 1. Add the Reporter

Update your `playwright.config.ts` to include the `NetworkMetricsReporter`. This "plugin" entry point will aggregate metrics from all workers and generate the final report.

```typescript
import { defineConfig } from "@playwright/test";

export default defineConfig({
  reporter: [
    ["list"],
    [
      "playwright-network-metrics",
      {
        html: true, // Generate an interactive HTML report
        outDir: "network-metrics-report",
      },
    ],
  ],
});
```

### 2. Collect Metrics in Tests

Extend your Playwright `test` with the `networkMetrics` fixture. It is **automatic** by default.

```typescript
import { test as base } from "@playwright/test";
import { defineNetworkMetricsFixture } from "playwright-network-metrics";

// Extend the test with our fixture
export const test = base.extend({
  networkMetrics: defineNetworkMetricsFixture({
    urlMatch: "**/api/**",
  }),
});

// Use it in your tests
test("my performance test", async ({ page }) => {
  await page.goto("/dashboard");
  // metrics are automatically collected and attached to the report
});
```

## Configuration

The `defineNetworkMetricsFixture` function and `NetworkMetricsReporter` accept a configuration object:

| Option              | Type                 | Default                               | Description                                          |
| ------------------- | -------------------- | ------------------------------------- | ---------------------------------------------------- |
| `outDir`            | `string`             | `"playwright-report/network-metrics"` | Directory where the reports will be written.         |
| `html`              | `boolean`            | `false`                               | Whether to generate an interactive HTML report.      |
| `urlMatch`          | `string \| string[]` | `"**"`                                | Glob pattern(s) to match URLs (e.g., `**/api/**`).   |
| `resourceTypes`     | `string[]`           | `[...]`                               | List of resource types to track.                     |
| `redactQueryParams` | `string[]`           | `[]`                                  | List of query parameters to redact from stored URLs. |
| `redactUrl`         | `function`           | `(url) => url`                        | Custom hook to modify the URL before storage.        |
| `routeGroupRules`   | `array`              | `[]`                                  | Rules for grouping URLs into logical categories.     |
| `routeGroupFn`      | `function`           | `undefined`                           | Custom hook for route grouping.                      |

### Custom Route Grouping

You can provide custom rules to group similar URLs together:

```typescript
{
  routeGroupRules: [
    { match: "**/api/v1/users/*", group: "/api/users/:id" },
    { match: "**/subscriptions/**", group: "Subscriptions" },
  ],
}
```

## Performance Notes

- **Low Overhead**: Does not store request/response bodies.
- **Memory Efficient**: Uses incremental aggregation and caps memory for percentile calculation.
- **Atomic Writing**: Writes reports only once at the end of the entire test run.

## License

MIT
