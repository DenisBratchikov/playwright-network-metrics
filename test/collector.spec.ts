import { NetworkMetricsCollector } from "../src/collector";

describe("NetworkMetricsCollector", () => {
  const createMockRequest = (url: string, resourceType = "fetch") =>
    ({
      url: () => url,
      resourceType: () => resourceType,
      method: () => "GET",
      timing: () => ({
        startTime: Date.now(),
        responseStart: 50,
        responseEnd: 100,
      }),
    } as any);

  it("should redact query parameters", () => {
    const collector = new NetworkMetricsCollector({
      redactQueryParams: ["token", "secret"],
    });

    const redacted = (collector as any).redactUrl(
      "http://example.com/api?user=foo&token=bar&secret=baz"
    );
    expect(redacted).toBe(
      "http://example.com/api?user=foo&token=%5BREDACTED%5D&secret=%5BREDACTED%5D"
    );
  });

  describe("resourceTypes", () => {
    it("should allow only specific types", () => {
      const collector = new NetworkMetricsCollector({
        resourceTypes: ["fetch"],
      });
      expect(
        (collector as any).shouldTrack(
          createMockRequest("http://a.com", "fetch")
        )
      ).toBe(true);
      expect(
        (collector as any).shouldTrack(
          createMockRequest("http://a.com", "image")
        )
      ).toBe(false);
    });
  });

  describe("urlMatch", () => {
    it("should match URL by glob string", () => {
      const collector = new NetworkMetricsCollector({
        urlMatch: "**/api/v1/**",
      });

      expect(
        (collector as any).shouldTrack(
          createMockRequest("http://example.com/api/v1/users")
        )
      ).toBe(true);
      expect(
        (collector as any).shouldTrack(
          createMockRequest("http://example.com/other")
        )
      ).toBe(false);
    });

    it("should match URL by array of globs", () => {
      const collector = new NetworkMetricsCollector({
        urlMatch: ["**/api/v1/**", "**/auth/**"],
      });
      expect(
        (collector as any).shouldTrack(
          createMockRequest("http://example.com/api/v1/users")
        )
      ).toBe(true);
      expect(
        (collector as any).shouldTrack(
          createMockRequest("http://example.com/auth/login")
        )
      ).toBe(true);
      expect(
        (collector as any).shouldTrack(
          createMockRequest("http://example.com/other")
        )
      ).toBe(false);
    });
  });

  describe("routeGrouping", () => {
    it("should group URLs using rules", () => {
      const collector = new NetworkMetricsCollector({
        routeGroupRules: [
          { match: "**/users/**", group: "Users" },
          { match: "**/orders/**", group: "Orders" },
        ],
      });

      expect((collector as any).getRouteGroup("http://api.com/users/1")).toBe(
        "Users"
      );
      expect((collector as any).getRouteGroup("http://api.com/orders/5")).toBe(
        "Orders"
      );
      expect(
        (collector as any).getRouteGroup("http://api.com/other")
      ).toBeUndefined();
    });

    it("should use routeGroupFn if provided", () => {
      const collector = new NetworkMetricsCollector({
        routeGroupFn: (url) =>
          url.includes("special") ? "Special" : undefined,
      });

      expect((collector as any).getRouteGroup("http://api.com/special/1")).toBe(
        "Special"
      );
      expect(
        (collector as any).getRouteGroup("http://api.com/other")
      ).toBeUndefined();
    });
  });
});
