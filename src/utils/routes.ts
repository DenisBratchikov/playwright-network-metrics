import type { NetworkMetricsConfig } from '../types';
import { matches } from './matchers';
import { normalizeUrlWithoutQuery } from './url';

function looksLikeId(segment: string): boolean {
  if (!segment) return false;
  if (/^[0-9]+$/.test(segment)) return true;
  if (/^[0-9a-fA-F-]{6,}$/.test(segment)) return true;
  return false;
}

export function applyRouteRules(url: string, config: NetworkMetricsConfig): string | undefined {
  if (!config.routeRules) return undefined;
  for (const rule of config.routeRules) {
    if (matches(url, rule.match)) {
      return typeof rule.group === 'function' ? rule.group(url) : rule.group;
    }
  }
  return undefined;
}

export function deriveRouteGroup(url: string, config: NetworkMetricsConfig): string {
  if (config.routeGroupFn) return config.routeGroupFn(url);
  const rule = applyRouteRules(url, config);
  if (rule) return rule;
  const normalized = normalizeUrlWithoutQuery(url);
  let path = normalized;
  try {
    const parsed = new URL(normalized);
    path = parsed.pathname;
  } catch {
    // keep fallback path
  }
  const parts = path.split('/').filter(Boolean);
  const mapped = parts.map((segment) => (looksLikeId(segment) ? ':id' : segment));
  return '/' + mapped.join('/');
}
