import type {
  AggregatedMetric,
  NetworkMetricsReport,
  RequestMetric,
} from "./types";

/**
 * Aggregates raw request metrics into summarizing reports.
 * Responsible for grouping metrics and calculating statistical data like averages and percentiles.
 */
export class NetworkMetricsAggregator {
  /**
   * Internal store for duration samples to calculate percentiles.
   */
  private samplesPerKey = new Map<string, number[]>();

  /**
   * Aggregates an array of individual request metrics into a comprehensive report.
   *
   * @param metrics Array of captured request metrics.
   * @returns A structured report with global totals and categorized aggregations.
   */
  aggregate(metrics: RequestMetric[]): NetworkMetricsReport {
    const endpointsNormalized = new Map<string, AggregatedMetric>();
    const endpointsExactWithQuery = new Map<string, AggregatedMetric>();
    const routeGroups = new Map<string, AggregatedMetric>();
    const resourceTypes = new Map<string, AggregatedMetric>();

    let totalDurationMs = 0;
    let totalFailedRequests = 0;

    for (const m of metrics) {
      totalDurationMs += m.duration;
      if (m.failed) totalFailedRequests++;

      // 1. Normalized (Method + URL without query)
      const normKey = `${m.method} ${m.url}`;
      this.updateAggregate(endpointsNormalized, normKey, m);

      // 2. Exact with query (Method + URL with potentially redacted query)
      const exactKey = `${m.method} ${m.urlWithQuery}`;
      this.updateAggregate(endpointsExactWithQuery, exactKey, m);

      // 3. Route Group (Method + Custom Group Name or 'Other')
      const routeGroup = m.group || "Other";
      const routeKey = `${m.method} ${routeGroup}`;
      this.updateAggregate(routeGroups, routeKey, m);

      // 4. Resource Type (e.g. "fetch", "xhr")
      this.updateAggregate(resourceTypes, m.resourceType, m);
    }

    /**
     * Helper to convert aggregation maps into sorted arrays of metrics.
     */
    const finalize = (map: Map<string, AggregatedMetric>) => {
      return Array.from(map.values())
        .map((am) => this.finalizeAggregatedMetric(am))
        .sort((a, b) => b.totalDurationMs - a.totalDurationMs);
    };

    return {
      totals: {
        totalRequests: metrics.length,
        totalFailedRequests,
        totalDurationMs,
        avgRequestDurationMs:
          metrics.length > 0 ? totalDurationMs / metrics.length : 0,
      },
      endpointsNormalized: finalize(endpointsNormalized),
      endpointsExactWithQuery: finalize(endpointsExactWithQuery),
      routeGroups: finalize(routeGroups),
      resourceTypes: finalize(resourceTypes),
    };
  }

  /**
   * Updates a single aggregation entry with new request data.
   */
  private updateAggregate(
    map: Map<string, AggregatedMetric>,
    key: string,
    m: RequestMetric,
  ) {
    let am = map.get(key);
    if (!am) {
      am = {
        key,
        method: m.method,
        count: 0,
        totalDurationMs: 0,
        totalLoadTimeMs: 0,
        avgDurationMs: 0,
        avgLoadTimeMs: 0,
        p50: 0,
        p95: 0,
        p99: 0,
        errorCount: 0,
        specs: [],
        tests: [],
      };
      map.set(key, am);
    }

    am.count++;
    am.totalDurationMs += m.duration;
    if (m.loadTime >= 0) {
      am.totalLoadTimeMs += m.loadTime;
    }
    if (m.failed) am.errorCount++;

    // Track samples for percentiles
    const samples = this.samplesPerKey.get(key) ?? [];
    samples.push(m.duration);
    this.samplesPerKey.set(key, samples);

    // Track contributing tests/specs
    if (m.specFile) {
      this.updateList(am.specs, m.specFile);
    }
    if (m.testName) {
      this.updateList(am.tests, m.testName);
    }
  }

  /**
   * Updates a frequency list for specs or tests.
   */
  private updateList(
    list: Array<{ name: string; count: number }>,
    value: string,
  ) {
    let entry = list.find((item) => item.name === value);
    if (!entry) {
      entry = { name: value, count: 1 };
      list.push(entry);
    } else {
      entry.count++;
    }
  }

  /**
   * Finalizes the calculation of an aggregated metric (averages, percentiles, sorting).
   */
  private finalizeAggregatedMetric(am: AggregatedMetric): AggregatedMetric {
    am.avgDurationMs = am.count > 0 ? am.totalDurationMs / am.count : 0;
    am.avgLoadTimeMs = am.count > 0 ? am.totalLoadTimeMs / am.count : 0;

    const samples = this.samplesPerKey.get(am.key) ?? [];
    if (samples.length > 0) {
      samples.sort((a, b) => a - b);
      am.p50 = this.getPercentile(samples, 50);
      am.p95 = this.getPercentile(samples, 95);
      am.p99 = this.getPercentile(samples, 99);
    }

    // Sort contributors by frequency
    am.specs.sort((a, b) => b.count - a.count);
    am.tests.sort((a, b) => b.count - a.count);

    return am;
  }

  /**
   * Calculates a percentile value from a sorted array of samples.
   */
  private getPercentile(sortedSamples: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sortedSamples.length) - 1;
    return sortedSamples[Math.max(0, index)];
  }
}
