import fs from "node:fs";
import path from "node:path";
import type {
  FullConfig,
  Reporter,
  TestCase,
  TestResult,
} from "@playwright/test/reporter";
import { NetworkMetricsAggregator } from "./aggregator";
import { generateHtmlReport } from "./html-report";
import type {
  NetworkMetricsReport,
  NetworkMetricsReporterConfig,
  RequestMetric,
} from "./types";

/**
 * A Playwright Reporter that aggregates network metrics from all test runs and generates reports.
 *
 * It collects metrics from worker processes via test attachments and produces
 * JSON and optional HTML summaries.
 */
export class NetworkMetricsReporter implements Reporter {
  /**
   * Internal store for all collected request metrics from all tests.
   */
  private allMetrics: RequestMetric[] = [];
  /**
   * Configuration for the plugin.
   */
  private config: Required<NetworkMetricsReporterConfig> = {
    outDir: "playwright-report/network-metrics",
    html: true,
  };

  onBegin(config: FullConfig) {
    // Try to find if the reporter was configured in playwright.config.ts
    const reporterEntry = config.reporter.find(([name]) =>
      name.includes("playwright-network-metrics")
    );

    if (reporterEntry && typeof reporterEntry[1] === "object") {
      this.config = {
        ...this.config,
        ...reporterEntry[1],
      };
    }
  }

  /**
   * Playwright lifecycle hook called after each test finishes.
   * Extracts "network-metrics" attachments and stores them for end-of-run aggregation.
   */
  onTestEnd(test: TestCase, result: TestResult) {
    // Find network metrics attachment if it exists
    const attachment = result.attachments.find(
      (a) => a.name === "network-metrics"
    );
    if (attachment?.body) {
      try {
        const metrics: RequestMetric[] = JSON.parse(attachment.body.toString());
        if (Array.isArray(metrics)) {
          this.allMetrics.push(
            ...metrics.map((item) => ({
              ...item,
              specFile: test.location.file,
              testName: test.title,
            }))
          );
        }
      } catch (_e) {
        // Ignore parsing errors
      }
    }
  }

  /**
   * Playwright lifecycle hook called after all tests have finished.
   * Aggregates all collected metrics and writes the final reports to disk.
   */
  async onEnd() {
    if (this.allMetrics.length === 0) {
      console.log("No network metrics collected.");
      return;
    }

    const aggregator = new NetworkMetricsAggregator();
    const report = aggregator.aggregate(this.allMetrics);

    const outputDir = path.resolve(this.config.outDir);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const jsonPath = path.join(outputDir, "network-metrics.json");
    fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
    console.log(`Network metrics JSON report: ${jsonPath}`);

    if (this.config.html) {
      const htmlPath = path.join(outputDir, "network-metrics.html");
      const htmlContent = this.generateHtml(report);
      fs.writeFileSync(htmlPath, htmlContent);
      console.log(`Network metrics HTML report: ${htmlPath}`);
    }
  }

  /**
   * Internal helper to trigger HTML report generation.
   */
  private generateHtml(report: NetworkMetricsReport): string {
    return generateHtmlReport(report);
  }
}

export default NetworkMetricsReporter;
