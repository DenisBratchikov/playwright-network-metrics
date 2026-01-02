import type { NetworkMetricsReport } from "./types";

/**
 * Generates a standalone HTML report visualizing the captured network metrics.
 *
 * Features:
 * - Summary statistics (Total requests, Failed requests, Average duration, Total duration).
 * - Filterable and sortable tables for all aggregation categories.
 * - Interactive tabs to switch between views.
 *
 * @param report The aggregated network metrics report.
 * @returns A string containing the full HTML document.
 */
export function generateHtmlReport(report: NetworkMetricsReport): string {
  const jsonReport = JSON.stringify(report);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Network Performance Metrics</title>
    <style>
        :root {
            --primary: #2980b9;
            --secondary: #34495e;
            --success: #27ae60;
            --error: #e74c3c;
            --bg: #f4f7f9;
            --card-bg: #ffffff;
            --text: #2c3e50;
            --text-muted: #7f8c8d;
            --border: #e1e8ed;
        }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: var(--text); margin: 0; padding: 20px; background: var(--bg); }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: var(--secondary); margin-bottom: 30px; font-weight: 700; }
        
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: var(--card-bg); padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid var(--border); transition: transform 0.2s; }
        .card:hover { transform: translateY(-2px); }
        .card h3 { margin: 0 0 10px 0; font-size: 0.8rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; }
        .card .value { font-size: 1.8rem; font-weight: 800; color: var(--primary); }
        .card .value.error { color: var(--error); }

        .search-container { margin-bottom: 25px; position: relative; }
        #search { width: 100%; padding: 12px 20px; border: 1px solid var(--border); border-radius: 8px; box-sizing: border-box; font-size: 1rem; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        #search:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 3px rgba(41, 128, 185, 0.1); }

        .tabs { display: flex; gap: 8px; margin-bottom: 20px; overflow-x: auto; padding-bottom: 5px; }
        .tab { cursor: pointer; padding: 10px 20px; border-radius: 8px; border: 1px solid var(--border); background: var(--card-bg); font-weight: 600; color: var(--text); transition: all 0.2s; white-space: nowrap; }
        .tab:hover { background: #f8f9fa; }
        .tab.active { background: var(--primary); color: white; border-color: var(--primary); }

        .table-wrapper { background: var(--card-bg); border-radius: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid var(--border); overflow: visible; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; }
        th, td { padding: 14px 18px; border-bottom: 1px solid var(--border); }
        th:first-child { border-top-left-radius: 12px; }
        th:last-child { border-top-right-radius: 12px; }
        tr:last-child td:first-child { border-bottom-left-radius: 12px; }
        tr:last-child td:last-child { border-bottom-right-radius: 12px; }
        th { background: #f8fafc; font-weight: 700; color: var(--secondary); font-size: 0.85rem; text-transform: uppercase; cursor: pointer; position: relative; white-space: nowrap; }
        th:hover { background: #f1f5f9; }
        
        tr.main-row { cursor: pointer; transition: background 0.1s; }
        tr.main-row:hover { background: #fcfdfe; }
        tr.expanded { background: #f8fafc; }
        
        .endpoint-key {
            max-width: 500px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            display: inline-block;
            vertical-align: middle;
        }

        .method { font-weight: 800; font-size: 0.7rem; padding: 3px 6px; border-radius: 4px; margin-right: 10px; display: inline-block; min-width: 45px; text-align: center; vertical-align: middle; }
        .GET { background: #e3f2fd; color: #1976d2; }
        .POST { background: #e8f5e9; color: #388e3c; }
        .PUT { background: #fff3e0; color: #f57c00; }
        .DELETE { background: #ffebee; color: #d32f2f; }
        
        .error-tag { color: var(--error); font-weight: 700; }
        
        /* Details row */
        .details-row { display: none; background: #f8fafc; }
        .details-row.show { display: table-row; }
        .details-content { padding: 20px; border-bottom: 1px solid var(--border); }
        .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
        .details-section h4 { margin: 0 0 10px 0; font-size: 0.9rem; color: var(--secondary); border-bottom: 1px solid #dee5ed; padding-bottom: 5px; }
        .details-list { margin: 0; padding: 0; list-style: none; font-size: 0.85rem; }
        .details-list li { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #e1e8ed; }
        .details-list li:last-child { border-bottom: none; }
        .count-badge { background: #edf2f7; padding: 2px 8px; border-radius: 10px; font-weight: 600; color: var(--secondary); }

        /* Tooltips */
        .tooltip { position: relative; display: inline-block; margin-left: 4px; cursor: help; color: #cbd5e0; }
        .tooltip:hover { color: var(--primary); }
        .tooltip .tooltiptext { visibility: hidden; width: 220px; background-color: #334155; color: #fff; text-align: center; border-radius: 6px; padding: 8px; position: absolute; z-index: 100; bottom: 125%; left: 50%; margin-left: -110px; opacity: 0; transition: opacity 0.2s; font-size: 0.75rem; text-transform: none; font-weight: 400; line-height: 1.4; pointer-events: none; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .tooltip:hover .tooltiptext { visibility: visible; opacity: 1; }
        
        .chevron { display: inline-block; transition: transform 0.2s; margin-right: 8px; width: 12px; height: 12px; fill: #cbd5e0; }
        tr.expanded .chevron { transform: rotate(90deg); fill: var(--primary); }
    </style>
</head>
<body>
    <div class="container">
        <h1>Network Performance Metrics</h1>
        
        <div class="summary">
            <div class="card">
                <h3>Total Requests</h3>
                <div class="value" id="stat-total-requests">-</div>
            </div>
            <div class="card">
                <h3>Avg Duration</h3>
                <div class="value" id="stat-avg-duration">-</div>
            </div>
            <div class="card">
                <h3>Total Duration</h3>
                <div class="value" id="stat-total-duration">-</div>
            </div>
            <div class="card">
                <h3>Failed Requests</h3>
                <div class="value error" id="stat-failed">-</div>
            </div>
        </div>

        <div class="search-container">
            <input type="text" id="search" placeholder="Filter by URL or method...">
        </div>

        <div class="tabs">
            <div class="tab active" data-target="endpointsNormalized">Endpoints (Normalized)</div>
            <div class="tab" data-target="endpointsExactWithQuery">Exact URLs</div>
            <div class="tab" data-target="routeGroups">Route Groups</div>
            <div class="tab" data-target="resourceTypes">Resource Types</div>
        </div>

        <div class="table-wrapper">
            <table id="metrics-table">
                <thead>
                    <tr id="table-header"></tr>
                </thead>
                <tbody id="table-body"></tbody>
            </table>
        </div>
    </div>

    <script>
        const report = ${jsonReport};
        let currentTab = 'endpointsNormalized';
        let sortKey = 'totalDurationMs';
        let sortOrder = -1; 
        let filterText = '';
        let expandedKeys = new Set();

        const columnMeta = {
            key: { label: 'Endpoint / Key', tooltip: 'The unique identifier for this aggregation group.' },
            count: { label: 'Count', tooltip: 'Total number of requests made.' },
            avgDurationMs: { label: 'Avg', tooltip: 'The average response time in milliseconds. This represents the total time from request start to the end of the response body.' },
            avgLoadTimeMs: { label: 'Load', tooltip: 'Resource Load Time: The time taken to download the resource body (responseEnd - responseStart).' },
            p50: { label: 'P50', tooltip: 'Median: 50% of requests were faster than this value.' },
            p95: { label: 'P95', tooltip: '95th Percentile: 95% of requests were faster than this value. Useful for identifying high-latency outliers.' },
            p99: { label: 'P99', tooltip: '99th Percentile: Only 1% of requests were slower than this value. Critical for tail latency optimization.' },
            totalDurationMs: { label: 'Total Time', tooltip: 'Sum of all response times for this group.' },
            errorCount: { label: 'Errors', tooltip: 'Number of failed requests (non-2xx response or network error).' }
        };

        function formatMs(ms) {
            return ms.toFixed(1) + 'ms';
        }

        function updateStats() {
            document.getElementById('stat-total-requests').textContent = report.totals.totalRequests;
            document.getElementById('stat-avg-duration').textContent = formatMs(report.totals.avgRequestDurationMs);
            document.getElementById('stat-total-duration').textContent = (report.totals.totalDurationMs / 1000).toFixed(2) + 's';
            document.getElementById('stat-failed').textContent = report.totals.totalFailedRequests;
        }

        function toggleExpand(key, event) {
            event.stopPropagation();
            if (expandedKeys.has(key)) {
                expandedKeys.delete(key);
            } else {
                expandedKeys.add(key);
            }
            renderTable();
        }

        function renderTable() {
            const data = report[currentTab].filter(item => {
                const searchStr = (item.method ? item.method + ' ' : '') + item.key;
                return searchStr.toLowerCase().includes(filterText.toLowerCase());
            });

            data.sort((a, b) => {
                if (currentTab === 'routeGroups') {
                    const aIsOther = a.key.endsWith('Other');
                    const bIsOther = b.key.endsWith('Other');
                    if (aIsOther && !bIsOther) return 1;
                    if (!aIsOther && bIsOther) return -1;
                }
                const valA = a[sortKey];
                const valB = b[sortKey];
                if (typeof valA === 'string') return valA.localeCompare(valB) * sortOrder;
                return (valA - valB) * sortOrder;
            });

            const header = document.getElementById('table-header');
            const body = document.getElementById('table-body');
            
            const columns = ['key', 'count', 'avgDurationMs', 'avgLoadTimeMs', 'p50', 'p95', 'p99', 'totalDurationMs', 'errorCount'];

            header.innerHTML = columns.map(k => \`
                <th onclick="handleSort('\${k}')">
                    \${columnMeta[k].label}
                    <span class="tooltip">ⓘ<span class="tooltiptext">\${columnMeta[k].tooltip}</span></span>
                    \${sortKey === k ? (sortOrder === 1 ? '▲' : '▼') : ''}
                </th>
            \`).join('');

            let html = '';
            data.forEach(item => {
                const isExpanded = expandedKeys.has(item.key);
                html += \`
                    <tr class="main-row \${isExpanded ? 'expanded' : ''}" onclick="toggleExpand('\${item.key}', event)">
                        <td>
                            <svg class="chevron" viewBox="0 0 20 20"><path d="M7 1L16 10L7 19" stroke="currentColor" stroke-width="2" fill="none"/></svg>
                            \${item.method ? \`<span class="method \${item.method}">\${item.method}</span>\` : ''}
                            <span class="endpoint-key" title="\${item.key}">\${item.key}</span>
                        </td>
                        <td>\${item.count}</td>
                        <td>\${formatMs(item.avgDurationMs)}</td>
                        <td>\${formatMs(item.avgLoadTimeMs)}</td>
                        <td>\${formatMs(item.p50)}</td>
                        <td>\${formatMs(item.p95)}</td>
                        <td>\${formatMs(item.p99)}</td>
                        <td>\${formatMs(item.totalDurationMs)}</td>
                        <td class="\${item.errorCount > 0 ? 'error-tag' : ''}">\${item.errorCount}</td>
                    </tr>
                \`;

                if (isExpanded) {
                    html += \`
                        <tr class="details-row show">
                            <td colspan="8">
                                <div class="details-content">
                                    <div class="details-grid">
                                        <div class="details-section">
                                            <h4>Contributing Spec Files</h4>
                                            <ul class="details-list">
                                                \${item.specs.map(s => \`<li><span>\${s.name}</span> <span class="count-badge">\${s.count}</span></li>\`).join('')}
                                            </ul>
                                        </div>
                                        <div class="details-section">
                                            <h4>Contributing Tests</h4>
                                            <ul class="details-list">
                                                \${item.tests.map(t => \`<li><span>\${t.name}</span> <span class="count-badge">\${t.count}</span></li>\`).join('')}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </td>
                        </tr>
                    \`;
                }
            });
            body.innerHTML = html;
        }

        function handleSort(key) {
            if (sortKey === key) sortOrder *= -1;
            else { sortKey = key; sortOrder = -1; }
            renderTable();
        }

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelector('.tab.active').classList.remove('active');
                tab.classList.add('active');
                currentTab = tab.dataset.target;
                expandedKeys.clear();
                renderTable();
            });
        });

        document.getElementById('search').addEventListener('input', (e) => {
            filterText = e.target.value;
            renderTable();
        });

        updateStats();
        renderTable();
    </script>
</body>
</html>`;
}
