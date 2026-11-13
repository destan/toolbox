import { describe, expect, it } from 'vitest';
import { getCountryFlag } from './phone-parser-and-formatter.models';

describe('phone-parser-and-formatter models', () => {
  describe('getCountryFlag', () => {
    it('converts an ISO 3166-1 alpha-2 code to a flag emoji', () => {
      expect(getCountryFlag('FR')).toBe('🇫🇷');
      expect(getCountryFlag('us')).toBe('🇺🇸');
    });

    it('returns undefined for a missing or malformed code', () => {
      expect(getCountryFlag(undefined)).toBeUndefined();
      expect(getCountryFlag('')).toBeUndefined();
      expect(getCountryFlag('FRA')).toBeUndefined();
      expect(getCountryFlag('1A')).toBeUndefined();
    });
  });
});
