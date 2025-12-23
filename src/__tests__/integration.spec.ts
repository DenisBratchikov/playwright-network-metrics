import { beforeAll, afterAll, describe, expect, it } from 'bun:test';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { chromium } from 'playwright';
import { NetworkMetricsCollector } from '../collector';

const delays: Record<string, number> = {
  '/api/user/123': 80,
  '/api/data': 50,
  '/style.css': 10,
  '/app.js': 5,
  '/image.png': 5,
};

let serverUrl = '';
let server: ReturnType<typeof createServer>;

function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url?.split('?')[0] ?? '/';
  const delay = delays[url] ?? 0;
  setTimeout(() => {
    if (url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end(`<!doctype html>
<html><head><link rel="stylesheet" href="/style.css"><script src="/app.js"></script></head><body><img src="/image.png" /><script>fetch('/api/user/123?token=secret');fetch('/api/data');</script></body></html>`);
      return;
    }
    if (url === '/api/user/123') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
      return;
    }
    if (url === '/api/data') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ items: [1, 2, 3] }));
      return;
    }
    if (url === '/style.css') {
      res.writeHead(200, { 'content-type': 'text/css' });
      res.end('body{background:#fff;}');
      return;
    }
    if (url === '/app.js') {
      res.writeHead(200, { 'content-type': 'application/javascript' });
      res.end('console.log("loaded")');
      return;
    }
    if (url === '/image.png') {
      res.writeHead(200, { 'content-type': 'image/png' });
      res.end('binary');
      return;
    }
    res.writeHead(404);
    res.end();
  }, delay);
}

beforeAll(async () => {
  server = createServer(handler);
  await new Promise<void>((resolve) => {
    server.listen(0, () => {
      const address = server.address();
      if (address && typeof address === 'object') {
        serverUrl = `http://127.0.0.1:${address.port}`;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('network metrics integration', () => {
  it('collects and aggregates requests', async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const collector = new NetworkMetricsCollector({ redactQueryParams: ['token'] });
    collector.attachToContext(context, () => ({ specFile: 'integration.spec.ts', testTitle: 'collects and aggregates requests' }));
    const page = await context.newPage();
    await page.goto(`${serverUrl}/`);
    await page.waitForTimeout(300);
    const report = collector.getAggregator().exportReport();
    expect(report.totals.totalRequests).toBeGreaterThanOrEqual(5);
    const normalized = report.endpointsNormalized.find((e) => e.key.includes('/api/user'));
    expect(normalized?.errorCount).toBe(0);
    const exactHasRedaction = report.endpointsExactWithQuery.some((e) =>
      decodeURIComponent(e.key).includes('[REDACTED]')
    );
    expect(exactHasRedaction).toBe(true);
    await browser.close();
  }, 15000);
});
