import type {
  AggregatedEntry,
  NetworkMetricsConfig,
  NetworkMetricsReport,
  NetworkTotals,
  RequestEvent,
  RouteGroupEntry,
  SpecSummary,
  TestReference,
  TestSummary,
} from './types';
import { deriveRouteGroup } from './utils/routes';
import { getDomain, normalizeUrl, redactUrl } from './utils/url';
import { percentile } from './utils/stats';

interface DurationBucket {
  count: number;
  total: number;
  min: number;
  max: number;
  durations: number[];
  errorCount: number;
  tests: Map<string, { title: string; file: string; total: number; count: number }>;
  specs: Map<string, { file: string; total: number; count: number }>;
  urls?: Map<string, { total: number; count: number }>; // for route groups
}

function createBucket(maxSamples?: number): DurationBucket {
  return {
    count: 0,
    total: 0,
    min: Number.POSITIVE_INFINITY,
    max: 0,
    durations: [],
    errorCount: 0,
    tests: new Map(),
    specs: new Map(),
    urls: undefined,
  };
}

function updateBucket(bucket: DurationBucket, duration: number, failed: boolean, meta?: { specFile?: string; testTitle?: string; url?: string }, maxSamples?: number) {
  bucket.count += 1;
  bucket.total += duration;
  bucket.min = Math.min(bucket.min, duration);
  bucket.max = Math.max(bucket.max, duration);
  if (failed) bucket.errorCount += 1;
  if (!maxSamples || bucket.durations.length < maxSamples) {
    bucket.durations.push(duration);
  }
  if (meta?.testTitle && meta.specFile) {
    const key = `${meta.specFile}::${meta.testTitle}`;
    const existing = bucket.tests.get(key) ?? { title: meta.testTitle, file: meta.specFile, total: 0, count: 0 };
    existing.total += duration;
    existing.count += 1;
    bucket.tests.set(key, existing);
  }
  if (meta?.specFile) {
    const specEntry = bucket.specs.get(meta.specFile) ?? { file: meta.specFile, total: 0, count: 0 };
    specEntry.total += duration;
    specEntry.count += 1;
    bucket.specs.set(meta.specFile, specEntry);
  }
  if (meta?.url) {
    if (!bucket.urls) bucket.urls = new Map();
    const existing = bucket.urls.get(meta.url) ?? { total: 0, count: 0 };
    existing.total += duration;
    existing.count += 1;
    bucket.urls.set(meta.url, existing);
  }
}

function bucketToEntry(key: string, bucket: DurationBucket, method?: string, extra?: Partial<AggregatedEntry>, topN = 5): AggregatedEntry {
  const p50 = percentile(bucket.durations, 50);
  const p90 = percentile(bucket.durations, 90);
  const p95 = percentile(bucket.durations, 95);
  const p99 = percentile(bucket.durations, 99);
  const base: AggregatedEntry = {
    key,
    method,
    count: bucket.count,
    totalDurationMs: bucket.total,
    avgDurationMs: bucket.count === 0 ? 0 : bucket.total / bucket.count,
    minDurationMs: bucket.count === 0 ? 0 : bucket.min,
    maxDurationMs: bucket.count === 0 ? 0 : bucket.max,
    p50,
    p90,
    p95,
    p99,
    errorCount: bucket.errorCount,
    topTests: Array.from(bucket.tests.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, topN)
      .map((t) => ({ title: t.title, file: t.file, totalDurationMs: t.total, count: t.count })),
    topSpecs: Array.from(bucket.specs.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, topN)
      .map((s) => ({ file: s.file, totalDurationMs: s.total, count: s.count })),
  };
  return { ...base, ...extra };
}

export class NetworkMetricsAggregator {
  private config: NetworkMetricsConfig;
  private normalized = new Map<string, DurationBucket>();
  private exact = new Map<string, DurationBucket>();
  private routeGroups = new Map<string, DurationBucket>();
  private resourceTypes = new Map<string, DurationBucket>();
  private events: RequestEvent[] = [];
  private totals: NetworkTotals = {
    totalRequests: 0,
    totalDurationMs: 0,
    avgRequestDurationMs: 0,
    totalFailedRequests: 0,
  };
  private specTotals = new Map<string, { file: string; total: number; count: number }>();
  private testTotals = new Map<string, { file: string; title: string; total: number; count: number }>();

  constructor(config: NetworkMetricsConfig) {
    this.config = { html: false, reportScope: 'run', outputDir: 'network-metrics-results', topN: 5, ...config };
  }

  record(event: RequestEvent) {
    this.events.push(event);
    this.totals.totalRequests += 1;
    this.totals.totalDurationMs += event.durationMs;
    if (event.failed) this.totals.totalFailedRequests += 1;

    if (event.specFile) {
      const specEntry = this.specTotals.get(event.specFile) ?? { file: event.specFile, total: 0, count: 0 };
      specEntry.total += event.durationMs;
      specEntry.count += 1;
      this.specTotals.set(event.specFile, specEntry);
    }
    if (event.specFile && event.testTitle) {
      const key = `${event.specFile}::${event.testTitle}`;
      const testEntry = this.testTotals.get(key) ?? { file: event.specFile, title: event.testTitle, total: 0, count: 0 };
      testEntry.total += event.durationMs;
      testEntry.count += 1;
      this.testTotals.set(key, testEntry);
    }

    const normalizedUrl = normalizeUrl(event.url, this.config);
    const routeGroup = event.routeGroup ?? deriveRouteGroup(event.url, this.config);
    const normalizedKey = `${event.method} ${normalizedUrl}::${routeGroup}`;
    const exactKey = `${event.method} ${redactUrl(event.urlWithQuery, this.config)}`;

    const bucketMeta = { specFile: event.specFile, testTitle: event.testTitle };

    const normalizedBucket = this.normalized.get(normalizedKey) ?? createBucket(this.config.maxSamplesPerKey);
    updateBucket(normalizedBucket, event.durationMs, event.failed, { ...bucketMeta }, this.config.maxSamplesPerKey);
    this.normalized.set(normalizedKey, normalizedBucket);

    const exactBucket = this.exact.get(exactKey) ?? createBucket(this.config.maxSamplesPerKey);
    updateBucket(exactBucket, event.durationMs, event.failed, { ...bucketMeta }, this.config.maxSamplesPerKey);
    this.exact.set(exactKey, exactBucket);

    const routeKey = routeGroup;
    const routeBucket = this.routeGroups.get(routeKey) ?? createBucket(this.config.maxSamplesPerKey);
    updateBucket(routeBucket, event.durationMs, event.failed, { ...bucketMeta, url: event.urlWithQuery }, this.config.maxSamplesPerKey);
    this.routeGroups.set(routeKey, routeBucket);

    const resourceKey = this.config.includeResourceTypeByDomain ? `${event.resourceType}::${getDomain(event.urlWithQuery) ?? 'unknown'}` : event.resourceType;
    const resourceBucket = this.resourceTypes.get(resourceKey) ?? createBucket(this.config.maxSamplesPerKey);
    updateBucket(resourceBucket, event.durationMs, event.failed, bucketMeta, this.config.maxSamplesPerKey);
    this.resourceTypes.set(resourceKey, resourceBucket);
  }

  merge(other: NetworkMetricsAggregator) {
    // Not implementing deep merge for now.
    other.exportReport();
  }

  private summarizeBuckets(
    map: Map<string, DurationBucket>,
    opts?: { topN?: number; parseMethod?: boolean; parseResource?: boolean }
  ): AggregatedEntry[] {
    const entries: AggregatedEntry[] = [];
    for (const [key, bucket] of Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      if (opts?.parseMethod) {
        const [method, ...rest] = key.split(' ');
        const joined = rest.join(' ');
        entries.push(bucketToEntry(joined, bucket, method, undefined, this.config.topN));
      } else if (opts?.parseResource) {
        const [resourceType, domain] = key.split('::');
        entries.push(bucketToEntry(resourceType, bucket, undefined, { resourceType, domain }, this.config.topN));
      } else {
        entries.push(bucketToEntry(key, bucket, undefined, undefined, this.config.topN));
      }
    }
    entries.sort((a, b) => b.totalDurationMs - a.totalDurationMs || a.key.localeCompare(b.key));
    return entries;
  }

  private summarizeNormalized(): AggregatedEntry[] {
    const entries: AggregatedEntry[] = [];
    for (const [key, bucket] of Array.from(this.normalized.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      const [method, ...rest] = key.split(' ');
      const joined = rest.join(' ');
      const [urlKey, routeGroup] = joined.split('::');
      const entry = bucketToEntry(urlKey, bucket, method, { routeGroup }, this.config.topN);
      entries.push(entry);
    }
    entries.sort((a, b) => b.totalDurationMs - a.totalDurationMs || a.key.localeCompare(b.key));
    return entries;
  }

  private summarizeRouteBuckets(): RouteGroupEntry[] {
    const entries: RouteGroupEntry[] = [];
    for (const [key, bucket] of Array.from(this.routeGroups.entries()).sort(([a], [b]) => a.localeCompare(b))) {
      const base = bucketToEntry(key, bucket, undefined, undefined, this.config.topN);
      const topUrls = bucket.urls
        ? Array.from(bucket.urls.entries())
            .map(([url, value]) => ({ url, totalDurationMs: value.total, count: value.count }))
            .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
            .slice(0, this.config.topN)
        : [];
      entries.push({ ...base, topUrls });
    }
    entries.sort((a, b) => b.totalDurationMs - a.totalDurationMs || a.key.localeCompare(b.key));
    return entries;
  }

  exportReport(): NetworkMetricsReport {
    this.totals.avgRequestDurationMs = this.totals.totalRequests === 0 ? 0 : this.totals.totalDurationMs / this.totals.totalRequests;
    const scope = this.config.reportScope ?? 'run';
    const includeSpecs = scope === 'spec' || scope === 'run+spec';
    const includeTests = scope === 'test' || scope === 'run+test';
    const specs: SpecSummary[] | undefined = includeSpecs
      ? Array.from(this.specTotals.values())
          .map((s) => ({ file: s.file, totalDurationMs: s.total, totalRequests: s.count }))
          .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
      : undefined;
    const tests: TestSummary[] | undefined = includeTests
      ? Array.from(this.testTotals.values())
          .map((t) => ({ file: t.file, title: t.title, totalDurationMs: t.total, totalRequests: t.count }))
          .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
      : undefined;

    return {
      totals: this.totals,
      specs,
      tests,
      endpointsNormalized: this.summarizeNormalized(),
      endpointsExactWithQuery: this.summarizeBuckets(this.exact, { parseMethod: true }),
      routeGroups: this.summarizeRouteBuckets(),
      resourceTypes: this.summarizeBuckets(this.resourceTypes, { parseResource: true }),
    };
  }

  exportEvents(): RequestEvent[] {
    return [...this.events];
  }

  consumeEvents(events: RequestEvent[]) {
    for (const event of events) {
      this.record(event);
    }
  }
}
