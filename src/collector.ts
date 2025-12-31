import type { Page, Request, Response, BrowserContext } from "@playwright/test";
import micromatch from "micromatch";
import type { NetworkMetricsConfig, RequestMetric } from "./types";
import { RESOURCE_TYPES } from "./constants";

/**
 * Orchestrates the collection of network metrics from Playwright Page or BrowserContext.
 * It listens to network events and maps them to RequestMetric objects based on configuration.
 */
export class NetworkMetricsCollector {
  private metrics: RequestMetric[] = [];
  private config: Required<NetworkMetricsConfig>;

  /**
   * Initializes the collector with optional configuration.
   * Merges user config with default values.
   *
   * @param config Partial configuration for filtering and redaction.
   */
  constructor(config: NetworkMetricsConfig = {}) {
    this.config = {
      urlMatch: "**",
      resourceTypes: RESOURCE_TYPES,
      shouldTrackRequest: () => true,
      redactQueryParams: [],
      redactUrl: (url) => url,
      routeGroupRules: [],
      routeGroupFn: () => undefined,
      ...config,
    };
  }

  /**
   * Attaches the collector to a Playwright Page or BrowserContext.
   * Begins listening for 'requestfinished' and 'requestfailed' events.
   *
   * @param target The Page or BrowserContext to instrument.
   */
  async attach(target: Page | BrowserContext) {
    target.on("requestfinished", (request) =>
      this.handleRequestFinished(request)
    );
    target.on("requestfailed", (request) => this.handleRequestFailed(request));
  }

  /**
   * Internal handler for successful requests.
   */
  private async handleRequestFinished(request: Request) {
    if (!this.shouldTrack(request)) return;

    const response = await request.response();
    if (!response) return;

    this.addMetric(request, response);
  }

  /**
   * Internal handler for failed requests.
   */
  private async handleRequestFailed(request: Request) {
    if (!this.shouldTrack(request)) return;

    this.addMetric(request, null, request.failure()?.errorText);
  }

  /**
   * Determines if a request should be recorded based on urlMatch, resourceTypes, and custom hooks.
   */
  private shouldTrack(request: Request): boolean {
    const url = request.url();
    const resourceType = request.resourceType();

    if (
      this.config.urlMatch &&
      !micromatch.isMatch(url, this.config.urlMatch)
    ) {
      return false;
    }

    if (!this.config.resourceTypes.includes(resourceType)) {
      return false;
    }

    if (!this.config.shouldTrackRequest(request)) {
      return false;
    }

    return true;
  }

  /**
   * Resolves the logical route group for a given URL based on configured rules.
   */
  private getRouteGroup(url: string): string | undefined {
    if (this.config.routeGroupFn) {
      const group = this.config.routeGroupFn(url);
      if (group) return group;
    }

    for (const rule of this.config.routeGroupRules) {
      if (micromatch.isMatch(url, rule.match)) {
        return rule.group;
      }
    }

    return undefined;
  }

  /**
   * Creates and stores a RequestMetric from a Playwright Request/Response.
   */
  private addMetric(
    request: Request,
    response: Response | null,
    errorText?: string
  ) {
    const timing = request.timing();
    const urlWithQuery = this.redactUrl(request.url());
    const urlParts = new URL(urlWithQuery);
    const url = `${urlParts.protocol}//${urlParts.host}${urlParts.pathname}`;

    // Duration is calculated as the time from the start of the response to the end of the response.
    const duration =
      timing.responseEnd >= 0 && timing.responseStart >= 0
        ? timing.responseEnd - timing.responseStart
        : -1;

    if (duration < 0) {
      // Skip requests with invalid timings (e.g. from cache or failed too early)
      console.warn(`Invalid duration for request ${url}: ${duration}`);
      return;
    }

    const metric: RequestMetric = {
      url,
      urlWithQuery,
      method: request.method(),
      status: response?.status() ?? 0,
      duration,
      resourceType: request.resourceType(),
      failed: !response || !response.ok(),
      errorText,
      timestamp: timing.startTime,
      group: this.getRouteGroup(url),
    };

    this.metrics.push(metric);
  }

  /**
   * Applies URL redaction based on config.redactUrl and config.redactQueryParams.
   */
  private redactUrl(url: string): string {
    let modifiedUrl = this.config.redactUrl(url);

    if (this.config.redactQueryParams.length > 0) {
      try {
        const urlObj = new URL(modifiedUrl);
        for (const param of this.config.redactQueryParams) {
          if (urlObj.searchParams.has(param)) {
            urlObj.searchParams.set(param, "[REDACTED]");
          }
        }
        modifiedUrl = urlObj.toString();
      } catch (e) {
        // Fallback to original if URL is invalid
      }
    }

    return modifiedUrl;
  }

  /**
   * Returns the list of captured metrics.
   */
  getMetrics(): RequestMetric[] {
    return this.metrics;
  }

  /**
   * Clears all captured metrics from the internal store.
   */
  clearMetrics() {
    this.metrics = [];
  }
}
