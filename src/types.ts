import type { Request } from '@playwright/test';

export type Pattern = string | RegExp;

export type Matcher = Pattern | ((value: string) => boolean);

export interface NormalizeQueryOptions {
  allowlist?: string[];
  denylist?: string[];
}

export interface RouteRule {
  match: Matcher;
  group: string | ((url: string) => string);
}

export interface NetworkMetricsConfig {
  outputDir?: string;
  html?: boolean;
  reportScope?: 'run' | 'spec' | 'test' | 'run+spec' | 'run+test';
  topN?: number;
  maxSamplesPerKey?: number;
  includeDomains?: Matcher[];
  excludeDomains?: Matcher[];
  allowUrlPatterns?: Matcher[];
  denyUrlPatterns?: Matcher[];
  allowMethods?: string[];
  denyMethods?: string[];
  allowResourceTypes?: string[];
  denyResourceTypes?: string[];
  normalizeQuery?: NormalizeQueryOptions;
  redactQueryParams?: string[];
  redactUrl?: (url: string) => string;
  shouldTrackRequest?: (request: Request) => boolean;
  routeRules?: RouteRule[];
  routeGroupFn?: (url: string) => string;
  includeResourceTypeByDomain?: boolean;
}

export interface TestReference {
  title: string;
  file: string;
}

export interface RequestEvent {
  url: string;
  urlWithQuery: string;
  method: string;
  status?: number;
  failed: boolean;
  errorText?: string;
  resourceType: string;
  responseType?: string;
  durationMs: number;
  specFile?: string;
  testTitle?: string;
  routeGroup?: string;
}

export interface AggregatedEntry {
  key: string;
  method?: string;
  routeGroup?: string;
  resourceType?: string;
  domain?: string;
  count: number;
  totalDurationMs: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  errorCount: number;
  topTests: Array<TestReference & { totalDurationMs: number; count: number }>;
  topSpecs: Array<{ file: string; totalDurationMs: number; count: number }>;
}

export interface RouteGroupEntry extends AggregatedEntry {
  topUrls: Array<{ url: string; totalDurationMs: number; count: number }>;
}

export interface ResourceTypeEntry extends AggregatedEntry {}

export interface NetworkTotals {
  totalRequests: number;
  totalDurationMs: number;
  avgRequestDurationMs: number;
  totalFailedRequests: number;
}

export interface SpecSummary {
  file: string;
  totalDurationMs: number;
  totalRequests: number;
}

export interface TestSummary {
  title: string;
  file: string;
  totalDurationMs: number;
  totalRequests: number;
}

export interface NetworkMetricsReport {
  totals: NetworkTotals;
  specs?: SpecSummary[];
  tests?: TestSummary[];
  endpointsNormalized: AggregatedEntry[];
  endpointsExactWithQuery: AggregatedEntry[];
  routeGroups: RouteGroupEntry[];
  resourceTypes: ResourceTypeEntry[];
}
