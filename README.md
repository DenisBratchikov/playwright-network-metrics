# playwright-network-metrics

Playwright instrumentation that captures and aggregates network performance metrics across your entire test run. It supports both a reporter and a fixture-based integration so you can collect data from every worker, merge it, and emit JSON (always) plus an optional HTML report.

## Installation

```bash
bun add playwright-network-metrics
# peer dependency
bun add -d @playwright/test
```

## Quick start (reporter)

`playwright.config.ts`

```ts
import { defineConfig } from '@playwright/test';
import NetworkMetricsReporter from 'playwright-network-metrics/dist/reporter';

export default defineConfig({
  reporter: [[NetworkMetricsReporter, { html: true, outputDir: 'network-metrics' }]],
});
```

Run your Playwright suite and find `network-metrics.json` (and `network-metrics.html` when enabled) inside `network-metrics/`.

## Quick start (fixture)

```ts
import { withNetworkMetrics } from 'playwright-network-metrics';
import { test as base, expect } from '@playwright/test';

const test = withNetworkMetrics(base, {
  outputDir: 'network-metrics',
  redactQueryParams: ['token'],
});

test('collects metrics', async ({ page, networkMetrics }) => {
  await page.goto('https://example.com');
  // instrument additional contexts if you create them manually
  // const cleanup = networkMetrics.instrumentContext(context, { specFile: testInfo.file, testTitle: testInfo.title });
  // cleanup();
});
```

Each worker writes `network-events-worker-<id>.json` and `network-metrics-worker-<id>.json` into the output directory. Combine them with the bundled reporter or by reading the event files and re-running the aggregation.

Attach the generated report inside a test when desired:

```ts
await testInfo.attach('network-metrics', {
  path: `${testInfo.project.outputDir}/network-metrics-worker-${testInfo.workerIndex}.json`,
  contentType: 'application/json',
});
```

## Custom fixture example (manual instrumentation)

If you prefer to wire the collector yourself instead of using `withNetworkMetrics`, you can extend Playwright’s base test directly:

```ts
import { test as base } from '@playwright/test';
import { NetworkMetricsCollector } from 'playwright-network-metrics';

export const test = base.extend<{
  networkMetrics: NetworkMetricsCollector;
}>({
  networkMetrics: [
    async ({ context, testInfo }, use) => {
      const collector = new NetworkMetricsCollector({
        allowUrlPatterns: ['**/api/**'],
        normalizeQuery: { allowlist: ['page', 'sort'] },
      });
      const cleanup = collector.attachToContext(context, () => ({
        specFile: testInfo.file,
        testTitle: testInfo.title,
      }));
      await use(collector);
      cleanup();
      await collector.writeEvents(`worker-${testInfo.workerIndex}`);
      await collector.writeReport(`worker-${testInfo.workerIndex}`);
    },
    { scope: 'worker' },
  ],
});
```

This mirrors the fixture helper while keeping full control over when contexts are instrumented or skipped.

## Configuration options

Key options (all optional):

- `outputDir`: directory for artifacts (default `network-metrics-results`).
- `html`: also emit a standalone `network-metrics.html` (default `false`).
- `reportScope`: `run` | `spec` | `test` | `run+spec` | `run+test`.
- `topN`: how many top tests/specs/URLs to surface (default `5`).
- `maxSamplesPerKey`: cap stored duration samples per aggregation key.
- Include/exclude controls: `includeDomains`, `excludeDomains`, `allowUrlPatterns`, `denyUrlPatterns`, `allowMethods`, `denyMethods`, `allowResourceTypes`, `denyResourceTypes`.
- `shouldTrackRequest(request)`: custom predicate.
- Query handling: `normalizeQuery` (allowlist/denylist), `redactQueryParams`, `redactUrl(url)`, `normalizeQuery` controls for grouped URLs (exact URLs always keep the full query, redacted).
- Route grouping: `routeRules`, `routeGroupFn`, `includeResourceTypeByDomain`.

### Examples

**Analyze only API fetches**

```ts
withNetworkMetrics(test, {
  allowResourceTypes: ['fetch', 'xhr'],
  allowUrlPatterns: ['**/api/**'],
});
```

**Normalize queries but keep exact aggregation**

```ts
withNetworkMetrics(test, {
  normalizeQuery: { allowlist: ['page', 'sort'] },
  redactQueryParams: ['token'],
});
```

**Route grouping rules**

```ts
withNetworkMetrics(test, {
  routeRules: [
    { match: /\/user\//, group: '/user/*' },
    { match: (url) => url.includes('/subscription/'), group: '/subscription/*' },
  ],
});
```

## Output shape (JSON)

`network-metrics.json`

```json
{
  "totals": {
    "totalRequests": 42,
    "totalDurationMs": 5123,
    "avgRequestDurationMs": 122,
    "totalFailedRequests": 1
  },
  "endpointsNormalized": [
    {
      "key": "GET https://api.example.com/users/:id",
      "count": 10,
      "totalDurationMs": 1100,
      "avgDurationMs": 110,
      "minDurationMs": 80,
      "maxDurationMs": 140,
      "p50": 105,
      "p90": 130,
      "p95": 138,
      "p99": 140,
      "errorCount": 0,
      "topTests": [{ "title": "gets users", "file": "tests/users.spec.ts", "totalDurationMs": 400, "count": 3 }],
      "topSpecs": [{ "file": "tests/users.spec.ts", "totalDurationMs": 400, "count": 3 }]
    }
  ],
  "endpointsExactWithQuery": [],
  "routeGroups": [],
  "resourceTypes": []
}
```

Fields are stably sorted to keep output deterministic. HTML output mirrors the JSON and renders sortable tables.

## How it works

- Listens to `request`, `requestfinished`, and `requestfailed` events on each instrumented `BrowserContext`.
- Captures metadata (method, status, timings, resource type, content type, normalized and exact URLs) without storing request/response bodies.
- Aggregates in-memory with bounded samples (via `maxSamplesPerKey`) to calculate percentiles.
- Writes deterministic JSON via a temporary file then renames it atomically. HTML is self-contained with zero external assets.

## Testing

- Unit coverage for URL normalization, route grouping heuristics, percentile math, and redaction (Bun test).
- Playwright-based integration test against a tiny local HTTP server to validate counts/durations and redaction behavior.

## Performance notes

Only lightweight metadata is kept in memory (no bodies). Aggregations keep duration samples per key up to the configured `maxSamplesPerKey`. Use the allow/deny filters to limit the surface area when running very large suites.

## How to contribute

1. Install dependencies with Bun:

   ```bash
   bun install
   ```

2. Run linting and tests locally:

```bash
bun x biome check .
bun test
```

3. Build the package (emits ESM, CJS, and type declarations):

   ```bash
   bun run build
   ```

4. Commit changes and open a PR. The CI workflow uses Bun for install, build, and tests.
