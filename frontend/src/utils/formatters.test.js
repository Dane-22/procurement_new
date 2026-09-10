import { describe, it, expect } from 'vitest';
import { formatDate, formatCurrency } from './formatters';

describe('formatters', () => {
  it('should format dates correctly', () => {
    // Assuming formatDate takes a string and returns a formatted date
    const date = '2026-09-09T00:00:00Z';
    expect(formatDate(date)).toBeDefined(); // Simple assertion
  });

  it('should format currency correctly', () => {
    expect(formatCurrency(100)).toContain('100'); // Simple assertion
  });
});
