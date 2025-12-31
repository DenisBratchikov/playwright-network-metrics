import { NetworkMetricsAggregator } from "../src/aggregator";
import { RequestMetric } from "../src/types";

describe("NetworkMetricsAggregator", () => {
  it("should aggregate metrics correctly", () => {
    const aggregator = new NetworkMetricsAggregator();
    const metrics: RequestMetric[] = [
      {
        url: "http://example.com/api/v1/users",
        urlWithQuery: "http://example.com/api/v1/users?id=1",
        method: "GET",
        status: 200,
        duration: 100,
        resourceType: "fetch",
        failed: false,
        timestamp: Date.now(),
      },
      {
        url: "http://example.com/api/v1/users",
        urlWithQuery: "http://example.com/api/v1/users?id=2",
        method: "GET",
        status: 200,
        duration: 200,
        resourceType: "fetch",
        failed: false,
        timestamp: Date.now(),
      },
    ];

    const report = aggregator.aggregate(metrics);

    expect(report.totals.totalRequests).toBe(2);
    expect(report.totals.totalDurationMs).toBe(300);
    expect(report.totals.avgRequestDurationMs).toBe(150);

    expect(report.endpointsNormalized).toHaveLength(1);
    expect(report.endpointsNormalized[0].count).toBe(2);
    expect(report.endpointsNormalized[0].avgDurationMs).toBe(150);

    expect(report.endpointsExactWithQuery).toHaveLength(2);
    expect(report.endpointsExactWithQuery[0].count).toBe(1);
  });

  it("should handle route groups", () => {
    const aggregator = new NetworkMetricsAggregator();
    const metrics: RequestMetric[] = [
      {
        url: "http://example.com/api/v1/users/123",
        urlWithQuery: "http://example.com/api/v1/users/123",
        method: "GET",
        status: 200,
        duration: 100,
        resourceType: "fetch",
        failed: false,
        timestamp: Date.now(),
        group: "/api/v1/users/:id",
      },
      {
        url: "http://example.com/api/v1/users/456",
        urlWithQuery: "http://example.com/api/v1/users/456",
        method: "GET",
        status: 200,
        duration: 200,
        resourceType: "fetch",
        failed: false,
        timestamp: Date.now(),
        group: "/api/v1/users/:id",
      },
    ];

    const report = aggregator.aggregate(metrics);

    expect(report.routeGroups).toHaveLength(1);
    expect(report.routeGroups[0].key).toBe("GET /api/v1/users/:id");
    expect(report.routeGroups[0].count).toBe(2);
  });

  it("should calculate percentiles correctly", () => {
    const aggregator = new NetworkMetricsAggregator();
    const metrics: RequestMetric[] = Array.from({ length: 100 }, (_, i) => ({
      url: "http://example.com/api",
      urlWithQuery: "http://example.com/api",
      method: "GET",
      status: 200,
      duration: i + 1, // 1 to 100
      resourceType: "fetch",
      failed: false,
      timestamp: Date.now(),
    }));

    const report = aggregator.aggregate(metrics);

    expect(report.endpointsNormalized[0].p50).toBe(50);
    expect(report.endpointsNormalized[0].p90).toBe(90);
    expect(report.endpointsNormalized[0].p95).toBe(95);
    expect(report.endpointsNormalized[0].p99).toBe(99);
  });
});
