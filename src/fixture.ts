import type { Fixtures, Page, TestInfo } from "@playwright/test";
import { NetworkMetricsCollector } from "./collector";
import type { NetworkMetricsConfig } from "./types";

/**
 * Returns a Playwright fixture tuple with automatic instrumentation.
 *
 * When used as a fixture, it automatically attaches to the current page,
 * collects network metrics throughout the test, and attaches the results
 * as a JSON file named "network-metrics" to the test report upon completion.
 *
 * @param config Optional configuration for the collector (filtering, redaction, grouping).
 * @returns A Playwright fixture tuple containing the collector and setup/teardown logic.
 *
 * @example
 * ```typescript
 * import { test as base } from '@playwright/test';
 * import { defineNetworkMetricsFixture } from 'playwright-network-metrics';
 *
 * export const test = base.extend({
 *   networkMetrics: defineNetworkMetricsFixture({
 *     urlMatch: "**" + "/api/" + "**",
 *   })
 * });
 * ```
 */
export const defineNetworkMetricsFixture: (
  config?: NetworkMetricsConfig
) => Fixtures = (config?: NetworkMetricsConfig) => {
  return [
    async (
      { page }: { page: Page },
      use: (collector: NetworkMetricsCollector) => Promise<void>,
      testInfo: TestInfo
    ) => {
      // Setup: attach collector to the page
      const collector = new NetworkMetricsCollector(config);
      await collector.attach(page);

      // Execute test
      await use(collector);

      // Teardown: capture metrics and attach to the test report
      const metrics = collector.getMetrics();
      await testInfo.attach("network-metrics", {
        body: JSON.stringify(metrics),
        contentType: "application/json",
      });
    },
    { title: "networkMetrics", auto: true, box: true },
  ];
};
