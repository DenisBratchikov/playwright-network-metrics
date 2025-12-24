import { URL } from 'node:url';
import type { NetworkMetricsConfig, NormalizeQueryOptions } from '../types';
import { matchesAny } from './matchers';

function filterQuery(searchParams: URLSearchParams, options?: NormalizeQueryOptions): URLSearchParams {
  if (!options) return searchParams;
  const next = new URLSearchParams();
  const allow = options.allowlist;
  const deny = options.denylist;
  for (const [key, value] of searchParams.entries()) {
    if (deny && deny.includes(key)) continue;
    if (allow && !allow.includes(key)) continue;
    next.append(key, value);
  }
  return next;
}

export function redactUrl(url: string, config: NetworkMetricsConfig): string {
  if (config.redactUrl) return config.redactUrl(url);
  if (!config.redactQueryParams || config.redactQueryParams.length === 0) return url;
  try {
    const parsed = new URL(url);
    for (const param of config.redactQueryParams) {
      if (parsed.searchParams.has(param)) {
        parsed.searchParams.set(param, '[REDACTED]');
      }
    }
    return parsed.toString();
  } catch (e) {
    return url;
  }
}

/**
 * Normalize a URL while respecting redaction and query allow/deny rules.
 * Used for the “normalized endpoint” aggregation key.
 */
export function normalizeUrl(url: string, config: NetworkMetricsConfig): string {
  const redacted = redactUrl(url, config);
  try {
    const parsed = new URL(redacted);
    const filtered = filterQuery(parsed.searchParams, config.normalizeQuery);
    parsed.search = filtered.toString();
    return parsed.origin + parsed.pathname + (filtered.toString() ? `?${filtered.toString()}` : '');
  } catch (e) {
    return redacted.split('?')[0];
  }
}

export function normalizeUrlWithoutQuery(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname;
  } catch (e) {
    return url.split('?')[0];
  }
}

export function getDomain(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch (e) {
    return undefined;
  }
}

export function shouldTrack(url: string, method: string, resourceType: string, config: NetworkMetricsConfig): boolean {
  if (matchesAny(url, config.denyUrlPatterns)) return false;
  if (matchesAny(url, config.allowUrlPatterns) === false && config.allowUrlPatterns && config.allowUrlPatterns.length > 0)
    return false;
  const domain = getDomain(url) ?? '';
  if (matchesAny(domain, config.excludeDomains)) return false;
  if (matchesAny(domain, config.includeDomains) === false && config.includeDomains && config.includeDomains.length > 0)
    return false;
  if (config.denyMethods && config.denyMethods.includes(method)) return false;
  if (config.allowMethods && !config.allowMethods.includes(method)) return false;
  if (config.denyResourceTypes && config.denyResourceTypes.includes(resourceType)) return false;
  if (config.allowResourceTypes && !config.allowResourceTypes.includes(resourceType)) return false;
  return true;
}
