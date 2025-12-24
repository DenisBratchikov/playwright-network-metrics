import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Reporter, FullResult } from '@playwright/test/reporter';
import { NetworkMetricsAggregator } from './aggregator';
import type { NetworkMetricsConfig, RequestEvent } from './types';
import { writeHtmlReport } from './html';

export interface ReporterOptions extends NetworkMetricsConfig {}

export default class NetworkMetricsReporter implements Reporter {
  private config: NetworkMetricsConfig;

  constructor(options: ReporterOptions = {}) {
    this.config = { outputDir: 'network-metrics-results', html: false, reportScope: 'run', topN: 5, ...options };
  }

  /**
   * Merge per-worker event payloads and emit the consolidated report (and optional HTML).
   * This keeps memory usage low in parallel runs while preserving deterministic output.
   */
  async onEnd(result: FullResult) {
    const outDir = this.config.outputDir ?? 'network-metrics-results';
    if (!existsSync(outDir)) return;
    const files = await readdir(outDir);
    const eventFiles = files.filter((f) => f.startsWith('network-events-') && f.endsWith('.json'));
    const aggregator = new NetworkMetricsAggregator(this.config);

    for (const file of eventFiles.sort()) {
      try {
        const content = await readFile(join(outDir, file), 'utf-8');
        const parsed = JSON.parse(content) as { events: RequestEvent[] };
        if (Array.isArray(parsed.events)) {
          aggregator.consumeEvents(parsed.events);
        }
      } catch (error) {
        // ignore individual file errors
      }
    }

    const report = aggregator.exportReport();
    await mkdir(outDir, { recursive: true });
    const jsonPath = join(outDir, 'network-metrics.json');
    const tmp = `${jsonPath}.tmp`;
    await writeFile(tmp, JSON.stringify(report, null, 2), 'utf-8');
    await rename(tmp, jsonPath);

    if (this.config.html) {
      await writeHtmlReport(report, outDir);
    }
  }
}
