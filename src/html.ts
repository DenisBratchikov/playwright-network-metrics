import { writeFile, rename } from 'node:fs/promises';
import { join } from 'node:path';
import type { NetworkMetricsReport } from './types';

export async function writeHtmlReport(report: NetworkMetricsReport, outputDir: string) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Playwright Network Metrics</title>
<style>
body { font-family: Arial, sans-serif; padding: 16px; }
h1 { margin-bottom: 8px; }
section { margin-bottom: 24px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
th { background: #f5f5f5; cursor: pointer; }
.filter { margin-right: 8px; }
.summary { display: flex; gap: 16px; margin-bottom: 12px; }
.summary div { background: #f5f5f5; padding: 8px 12px; border-radius: 6px; }
</style>
</head>
<body>
<h1>Playwright Network Metrics</h1>
<div class="summary">
  <div><strong>Total Requests:</strong> <span id="totalRequests"></span></div>
  <div><strong>Total Duration (ms):</strong> <span id="totalDuration"></span></div>
  <div><strong>Avg Request (ms):</strong> <span id="avgRequest"></span></div>
</div>
<div id="filters"></div>
<section>
  <h2>Top normalized endpoints</h2>
  <div id="table-endpoints"></div>
</section>
<section>
  <h2>Top exact URLs</h2>
  <div id="table-exact"></div>
</section>
<section>
  <h2>Route groups</h2>
  <div id="table-routes"></div>
</section>
<section>
  <h2>Resource types</h2>
  <div id="table-resources"></div>
</section>
<script>
const data = ${JSON.stringify(report)};
function createTable(rows, headers, containerId) {
  const container = document.getElementById(containerId);
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const tr = document.createElement('tr');
  headers.forEach(h => { const th = document.createElement('th'); th.textContent = h; tr.appendChild(th); });
  thead.appendChild(tr);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach(r => {
    const tr = document.createElement('tr');
    headers.forEach(h => {
      const td = document.createElement('td');
      const key = h.toLowerCase();
      td.textContent = r[key] !== undefined ? String(r[key]) : '';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.innerHTML = '';
  container.appendChild(table);
}

function formatEntry(entry) {
  return {
    key: entry.key,
    method: entry.method || '',
    count: entry.count,
    totaldurationms: entry.totalDurationMs,
    avgdurationms: entry.avgDurationMs.toFixed(2),
    p95: entry.p95.toFixed(2),
    errorcount: entry.errorCount,
  };
}

document.getElementById('totalRequests').textContent = data.totals.totalRequests;
document.getElementById('totalDuration').textContent = Math.round(data.totals.totalDurationMs);
document.getElementById('avgRequest').textContent = data.totals.avgRequestDurationMs.toFixed(2);

createTable(data.endpointsNormalized.map(formatEntry), ['Key', 'Method', 'Count', 'TotalDurationMs', 'AvgDurationMs', 'P95', 'ErrorCount'], 'table-endpoints');
createTable(data.endpointsExactWithQuery.map(formatEntry), ['Key', 'Method', 'Count', 'TotalDurationMs', 'AvgDurationMs', 'P95', 'ErrorCount'], 'table-exact');
createTable(data.routeGroups.map(formatEntry), ['Key', 'Count', 'TotalDurationMs', 'AvgDurationMs', 'P95', 'ErrorCount'], 'table-routes');
createTable(data.resourceTypes.map(formatEntry), ['Key', 'Count', 'TotalDurationMs', 'AvgDurationMs', 'P95', 'ErrorCount'], 'table-resources');
</script>
</body>
</html>`;

  const htmlPath = join(outputDir, 'network-metrics.html');
  const tmp = `${htmlPath}.tmp`;
  await writeFile(tmp, html, 'utf-8');
  await rename(tmp, htmlPath);
}
