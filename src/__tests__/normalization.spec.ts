import { describe, expect, it } from 'bun:test';
import { normalizeUrl, redactUrl } from '../utils/url';
import { deriveRouteGroup } from '../utils/routes';
import { percentile } from '../utils/stats';

const config = { redactQueryParams: ['token'] } as const;

describe('url normalization', () => {
  it('removes disallowed params and redacts tokens', () => {
    const normalized = normalizeUrl('https://example.com/api/user?id=1&token=secret&keep=yes', {
      normalizeQuery: { allowlist: ['keep', 'token'] },
      redactQueryParams: ['token'],
    });
    expect(normalized).toContain('token=%5BREDACTED%5D');
    expect(normalized).toContain('keep=yes');
  });

  it('redacts sensitive params', () => {
    const redacted = redactUrl('https://example.com/api?token=abc&other=1', { redactQueryParams: ['token'] });
    expect(redacted).toContain('token=%5BREDACTED%5D');
  });
});

describe('route grouping', () => {
  it('replaces id-like segments with :id', () => {
    const group = deriveRouteGroup('https://example.com/users/12345/details', {});
    expect(group).toBe('/users/:id/details');
  });

  it('applies explicit route rules', () => {
    const group = deriveRouteGroup('https://example.com/users/123', { routeRules: [{ match: /users\//, group: '/users/*' }] });
    expect(group).toBe('/users/*');
  });
});

describe('percentiles', () => {
  it('computes percentile for small sample sets', () => {
    const values = [10, 20, 30, 40];
    expect(percentile(values, 50)).toBe(25);
    expect(percentile(values, 90)).toBeCloseTo(37);
  });
});
