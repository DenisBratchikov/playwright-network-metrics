import type { BrowserContext, TestInfo, TestType, WorkerInfo } from '@playwright/test';
import { test as base } from '@playwright/test';
import { NetworkMetricsCollector } from './collector';
import type { NetworkMetricsConfig } from './types';

export interface NetworkMetricsFixture {
  collector: NetworkMetricsCollector;
  instrumentContext: (context: BrowserContext, meta?: { specFile?: string; testTitle?: string }) => () => void;
}

/**
 * Wrap a Playwright base test with network metrics instrumentation.
 * Users can skip this helper and instead instantiate `NetworkMetricsCollector`
 * manually inside their own fixtures to mirror this behavior.
 */
export function withNetworkMetrics<T extends TestType<any, any>>(baseTest: T = base as unknown as T, config: NetworkMetricsConfig = {}): T & { networkMetrics: NetworkMetricsFixture } {
  const resolvedConfig = { outputDir: 'network-metrics-results', ...config };
  return baseTest.extend<{ networkMetrics: NetworkMetricsFixture }>({
    networkMetrics: [
      async ({ workerInfo }: { workerInfo: WorkerInfo }, use: (fixture: NetworkMetricsFixture) => Promise<void>) => {
        const collector = new NetworkMetricsCollector(resolvedConfig);
        await use({
          collector,
          instrumentContext: (context: BrowserContext, meta?: { specFile?: string; testTitle?: string }) =>
            collector.attachToContext(context, () => meta ?? {}),
        });
        const workerId = `worker-${workerInfo.workerIndex}`;
        await collector.writeEvents(workerId);
        await collector.writeReport(workerId);
      },
      { scope: 'worker' },
    ],
    context: async (
      { context, testInfo, networkMetrics }: { context: BrowserContext; testInfo: TestInfo; networkMetrics: NetworkMetricsFixture },
      use: (context: BrowserContext) => Promise<void>
    ) => {
      const cleanup = networkMetrics.instrumentContext(context, { specFile: testInfo.file, testTitle: testInfo.title });
      await use(context);
      cleanup();
    },
  }) as unknown as T & { networkMetrics: NetworkMetricsFixture };
}
