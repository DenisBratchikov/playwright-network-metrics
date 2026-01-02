import type { Request } from "@playwright/test";

/**
 * Configuration for the network metrics collector.
 */
export interface NetworkMetricsConfig {
  /**
   * Filter requests by URL pattern using glob strings or an array of glob strings.
   * Wildcards like `** /api/ **` are supported.
   * @default "**"
   * @see https://www.npmjs.com/package/micromatch
   */
  urlMatch?: string | string[];

  /**
   * List of Playwright resource types to track.
   * @default ["fetch", "xhr", "document", "script", "style", "image", "font", "other"]
   */
  resourceTypes?: string[];

  /**
   * Custom hook to determine if a specific request should be tracked.
   * Returning false will skip this request.
   */
  shouldTrackRequest?: (request: Request) => boolean;

  /**
   * List of query parameter names to redact from the stored URLs.
   * The values will be replaced with "[REDACTED]".
   * @default []
   */
  redactQueryParams?: string[];

  /**
   * Custom hook to redact or modify the entire URL string before it is stored.
   * This is called before redactQueryParams.
   * @default (url) => url
   */
  redactUrl?: (url: string) => string;

  /**
   * Rules for grouping URLs into logical categories (e.g., "/api/users/:id").
   * Supports glob patterns for matching.
   */
  routeGroupRules?: Array<{
    /**
     * Glob pattern or array of patterns to match the URL against.
     */
    match: string | string[];
    /**
     * The name of the group to assign if matched.
     */
    group: string;
  }>;

  /**
   * Custom hook for route grouping. Takes precedence over routeGroupRules.
   * Should return the group name or undefined to use default rules.
   */
  routeGroupFn?: (url: string) => string | undefined;
}

/**
 * Configuration for the Playwright reporter plugin.
 */
export interface NetworkMetricsReporterConfig {
  /**
   * Directory where the metrics reports (JSON/HTML) will be saved.
   * @default "playwright-report/network-metrics"
   */
  outDir?: string;

  /**
   * Whether to generate an interactive HTML report.
   * @default false
   */
  html?: boolean;
}

/**
 * Data captured for a single finished or failed network request.
 */
export interface RequestMetric {
  /**
   * The base URL of the request (with protocol, host, and path; no query).
   */
  url: string;
  /**
   * The full URL including query parameters (potentially redacted).
   */
  urlWithQuery: string;
  /**
   * HTTP method (e.g., "GET", "POST").
   */
  method: string;
  /**
   * HTTP status code (0 if failed without status).
   */
  status: number;
  /**
   * Request duration in milliseconds.
   */
  duration: number;
  /**
   * Resource loading time (responseEnd - responseStart) in milliseconds.
   */
  loadTime: number;
  /**
   * Playwright resource type (e.g., "fetch", "xhr", "image").
   */
  resourceType: string;
  /**
   * Whether the request failed (e.g., non-2xx status or connection error).
   */
  failed: boolean;
  /**
   * Error message if the request failed.
   */
  errorText?: string;
  /**
   * Timestamp when the request started.
   */
  timestamp: number;
  /**
   * The file path of the test spec that triggered this request.
   */
  specFile?: string;
  /**
   * The name/title of the test that triggered this request.
   */
  testName?: string;
  /**
   * The logical group name assigned to this request (if any).
   */
  group?: string;
}

/**
 * Statistics aggregated for a specific key (URL, group, or resource type).
 */
export interface AggregatedMetric {
  /**
   * The identifier for this aggregate (e.g., the URL or Group Name).
   */
  key: string;
  /**
   * The HTTP method associated with these metrics (if applicable).
   */
  method?: string;
  /**
   * Total number of requests in this category.
   */
  count: number;
  /**
   * Total duration of all requests in this category in milliseconds.
   */
  totalDurationMs: number;
  /**
   * Total load time of all requests in this category (responseEnd - responseStart).
   */
  totalLoadTimeMs: number;
  /**
   * Average duration of requests in this category.
   */
  avgDurationMs: number;
  /**
   * Median duration (50th percentile).
   */
  p50: number;
  /**
   * 95th percentile duration.
   */
  p95: number;
  /**
   * 99th percentile duration.
   */
  p99: number;
  /**
   * Average load time of requests in this category.
   */
  avgLoadTimeMs: number;
  /**
   * Total number of failed requests in this category.
   */
  errorCount: number;
  /**
   * Top spec files contributing to this category, sorted by count.
   */
  specs: Array<{ name: string; count: number }>;
  /**
   * Top individual tests contributing to this category, sorted by count.
   */
  tests: Array<{ name: string; count: number }>;
}

/**
 * The final structure of the network metrics report.
 */
export interface NetworkMetricsReport {
  /**
   * Global summary statistics.
   */
  totals: {
    /**
     * Total number of requests tracked across all tests.
     */
    totalRequests: number;
    /**
     * Total number of failed requests across all tests.
     */
    totalFailedRequests: number;
    /**
     * Sum of durations of all tracked requests.
     */
    totalDurationMs: number;
    /**
     * Calculated average duration per request.
     */
    avgRequestDurationMs: number;
  };
  /**
   * Metrics grouped by normalized URL (Method + Base Path).
   */
  endpointsNormalized: AggregatedMetric[];
  /**
   * Metrics grouped by exact URL with query strings.
   */
  endpointsExactWithQuery: AggregatedMetric[];
  /**
   * Metrics grouped by custom route grouping rules.
   */
  routeGroups: AggregatedMetric[];
  /**
   * Metrics grouped by Playwright resource types.
   */
  resourceTypes: AggregatedMetric[];
}
