import { mkdir, rename as fsRename, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { BrowserContext, Request } from '@playwright/test';
import type { NetworkMetricsConfig, RequestEvent } from './types';
import { NetworkMetricsAggregator } from './aggregator';
import { deriveRouteGroup } from './utils/routes';
import { getDomain, normalizeUrlWithoutQuery, redactUrl, shouldTrack } from './utils/url';

interface TrackingState {
  startedAt: number;
  resourceType: string;
  url: string;
}

function getRequestKey(request: Request, startedAt?: number): string {
  const idFn = (request as any).requestId ?? (request as any)._requestId;
  if (typeof idFn === 'function') {
    const value = idFn.call(request);
    if (value) return value;
  }
  const maybeId = (request as any)._requestId ?? (request as any)._guid;
  if (maybeId) return String(maybeId);
  return `${request.url()}-${startedAt ?? Date.now()}`;
}

export class NetworkMetricsCollector {
  private config: NetworkMetricsConfig;
  private aggregator: NetworkMetricsAggregator;
  private tracking = new Map<string, TrackingState>();

  constructor(config: NetworkMetricsConfig = {}) {
    this.config = { outputDir: 'network-metrics-results', topN: 5, html: false, reportScope: 'run', ...config };
    this.aggregator = new NetworkMetricsAggregator(this.config);
  }

  attachToContext(context: BrowserContext, metaProvider: () => { specFile?: string; testTitle?: string }): () => void {
    const onRequest = (request: Request) => {
      const resourceType = request.resourceType?.() ?? 'other';
      if (this.config.shouldTrackRequest && !this.config.shouldTrackRequest(request)) return;
      if (!shouldTrack(request.url(), request.method(), resourceType, this.config)) return;
      const key = getRequestKey(request, Date.now());
      this.tracking.set(key, {
        startedAt: Date.now(),
        resourceType,
        url: request.url(),
      });
    };
    const finalize = async (request: Request, failed: boolean) => {
      const key = getRequestKey(request);
      const state = this.tracking.get(key);
      const meta = metaProvider();
      if (!state) return;
      this.tracking.delete(key);
      const response = await request.response().catch(() => undefined);
      const end = Date.now();
      const duration = end - state.startedAt;
      const status = response?.status();
      const headers: Record<string, string> = (await response?.allHeaders().catch(() => undefined)) ?? {};
      const contentType = headers['content-type'];
      const routeGroup = deriveRouteGroup(state.url, this.config);
      const urlWithQuery = redactUrl(request.url(), this.config);
      const event: RequestEvent = {
        url: normalizeUrlWithoutQuery(state.url),
        urlWithQuery,
        method: request.method(),
        status,
        failed,
        errorText: failed ? request.failure()?.errorText : undefined,
        resourceType: state.resourceType,
        responseType: contentType,
        durationMs: duration,
        specFile: meta.specFile,
        testTitle: meta.testTitle,
        routeGroup,
      };
      this.aggregator.record(event);
    };
    const onFinished = (request: Request) => finalize(request, false);
    const onFailed = (request: Request) => finalize(request, true);

    context.on('request', onRequest);
    context.on('requestfinished', onFinished);
    context.on('requestfailed', onFailed);

    return () => {
      context.off('request', onRequest);
      context.off('requestfinished', onFinished);
      context.off('requestfailed', onFailed);
    };
  }

  getAggregator() {
    return this.aggregator;
  }

  async writeReport(id: string = randomUUID()): Promise<NetworkMetricsAggregator> {
    const report = this.aggregator.exportReport();
    const outDir = this.config.outputDir ?? 'network-metrics-results';
    await mkdir(outDir, { recursive: true });
    const jsonPath = join(outDir, `network-metrics-${id}.json`);
    const tmp = `${jsonPath}.tmp`;
    await writeFile(tmp, JSON.stringify(report, null, 2), 'utf-8');
    await fsRename(tmp, jsonPath);
    return this.aggregator;
  }

  async writeEvents(id: string = randomUUID()): Promise<string> {
    const events = this.aggregator.exportEvents();
    const outDir = this.config.outputDir ?? 'network-metrics-results';
    await mkdir(outDir, { recursive: true });
    const jsonPath = join(outDir, `network-events-${id}.json`);
    const tmp = `${jsonPath}.tmp`;
    await writeFile(tmp, JSON.stringify({ events }, null, 2), 'utf-8');
    await fsRename(tmp, jsonPath);
    return jsonPath;
  }
}
