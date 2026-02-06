/**
 * Tests for the V2 inactivity condition helper functions.
 */

import { describe, it, expect } from 'vitest';
import type { RuleConditions } from '@tracearr/shared';
import {
  hasInactivityCondition,
  extractInactiveDaysFromConditions,
} from '../inactivityCheckQueue.js';

describe('hasInactivityCondition', () => {
  it('returns false for null conditions', () => {
    expect(hasInactivityCondition(null)).toBe(false);
  });

  it('returns false for conditions with no groups', () => {
    expect(hasInactivityCondition({ groups: [] })).toBe(false);
  });

  it('returns false when no inactive_days field exists', () => {
    const conditions: RuleConditions = {
      groups: [
        {
          conditions: [{ field: 'concurrent_streams', operator: 'gt', value: 2 }],
        },
      ],
    };
    expect(hasInactivityCondition(conditions)).toBe(false);
  });

  it('returns true for single group with inactive_days', () => {
    const conditions: RuleConditions = {
      groups: [
        {
          conditions: [{ field: 'inactive_days', operator: 'gt', value: 30 }],
        },
      ],
    };
    expect(hasInactivityCondition(conditions)).toBe(true);
  });

  it('returns true when inactive_days is in a later group', () => {
    const conditions: RuleConditions = {
      groups: [
        {
          conditions: [{ field: 'concurrent_streams', operator: 'gt', value: 2 }],
        },
        {
          conditions: [{ field: 'inactive_days', operator: 'gte', value: 14 }],
        },
      ],
    };
    expect(hasInactivityCondition(conditions)).toBe(true);
  });

  it('returns true when inactive_days is alongside other conditions in same group (OR)', () => {
    const conditions: RuleConditions = {
      groups: [
        {
          conditions: [
            { field: 'inactive_days', operator: 'gt', value: 30 },
            { field: 'trust_score', operator: 'lt', value: 20 },
          ],
        },
      ],
    };
    expect(hasInactivityCondition(conditions)).toBe(true);
  });
});

describe('extractInactiveDaysFromConditions', () => {
  it('returns null for null conditions', () => {
    expect(extractInactiveDaysFromConditions(null)).toBeNull();
  });

  it('returns null for conditions with no groups', () => {
    expect(extractInactiveDaysFromConditions({ groups: [] })).toBeNull();
  });

  it('returns null when no inactive_days field exists', () => {
    const conditions: RuleConditions = {
      groups: [
        {
          conditions: [{ field: 'concurrent_streams', operator: 'gt', value: 2 }],
        },
      ],
    };
    expect(extractInactiveDaysFromConditions(conditions)).toBeNull();
  });

  it('extracts value from single inactive_days condition', () => {
    const conditions: RuleConditions = {
      groups: [
        {
          conditions: [{ field: 'inactive_days', operator: 'gt', value: 30 }],
        },
      ],
    };
    expect(extractInactiveDaysFromConditions(conditions)).toBe(30);
  });

  it('returns first inactive_days value when multiple exist', () => {
    const conditions: RuleConditions = {
      groups: [
        {
          conditions: [
            { field: 'inactive_days', operator: 'gt', value: 10 },
            { field: 'inactive_days', operator: 'lt', value: 100 },
          ],
        },
      ],
    };
    expect(extractInactiveDaysFromConditions(conditions)).toBe(10);
  });

  it('finds inactive_days in a later group', () => {
    const conditions: RuleConditions = {
      groups: [
        {
          conditions: [{ field: 'concurrent_streams', operator: 'gt', value: 2 }],
        },
        {
          conditions: [{ field: 'inactive_days', operator: 'gte', value: 7 }],
        },
      ],
    };
    expect(extractInactiveDaysFromConditions(conditions)).toBe(7);
  });

  it('returns null when inactive_days value is not a number', () => {
    const conditions: RuleConditions = {
      groups: [
        {
          conditions: [
            { field: 'inactive_days', operator: 'eq', value: 'thirty' as unknown as number },
          ],
        },
      ],
    };
    expect(extractInactiveDaysFromConditions(conditions)).toBeNull();
  });
});
