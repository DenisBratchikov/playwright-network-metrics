import micromatch from 'micromatch';
import type { Matcher } from '../types';

export function matches(value: string, matcher: Matcher): boolean {
  if (typeof matcher === 'function') return matcher(value);
  if (matcher instanceof RegExp) return matcher.test(value);
  return micromatch.isMatch(value, matcher);
}

export function matchesAny(value: string, list?: Matcher[]): boolean {
  if (!list || list.length === 0) return false;
  return list.some((matcher) => matches(value, matcher));
}
