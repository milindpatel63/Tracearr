import { describe, it, expect } from 'vitest';
import { sanitizeCodec } from '../codecNormalizer.js';

describe('sanitizeCodec', () => {
  it('returns null for null/undefined input', () => {
    expect(sanitizeCodec(null)).toBeNull();
    expect(sanitizeCodec(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(sanitizeCodec('')).toBeNull();
  });

  it('uppercases valid codec strings', () => {
    expect(sanitizeCodec('hevc')).toBe('HEVC');
    expect(sanitizeCodec('h264')).toBe('H264');
    expect(sanitizeCodec('aac')).toBe('AAC');
  });

  it('returns null for strings exceeding 50 characters', () => {
    const longString = '/VIDEOS/09B20FF1-84AB-9FD2-E520-EAD56851D3CD/STREAM';
    expect(longString.length).toBeGreaterThan(50);
    expect(sanitizeCodec(longString)).toBeNull();
  });

  it('accepts strings at exactly 50 characters', () => {
    const exactly50 = 'A'.repeat(50);
    expect(sanitizeCodec(exactly50)).toBe(exactly50);
  });

  it('returns null for strings at 51 characters', () => {
    const exactly51 = 'A'.repeat(51);
    expect(sanitizeCodec(exactly51)).toBeNull();
  });
});
