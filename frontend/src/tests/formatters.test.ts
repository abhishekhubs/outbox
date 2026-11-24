import { describe, it, expect } from 'vitest';
import { getStatusBadgeClasses, getStatusDotColor } from '../utils/formatters';

describe('Frontend Formatters & Status Mapping', () => {
  it('should return appropriate badge style for all core email statuses', () => {
    expect(getStatusBadgeClasses('sent')).toContain('emerald');
    expect(getStatusBadgeClasses('scheduled')).toContain('blue');
    expect(getStatusBadgeClasses('processing')).toContain('amber');
    expect(getStatusBadgeClasses('retrying')).toContain('yellow');
    expect(getStatusBadgeClasses('failed')).toContain('rose');
    expect(getStatusBadgeClasses('cancelled')).toContain('slate');
  });

  it('should return matching dot indicator colors', () => {
    expect(getStatusDotColor('sent')).toBe('bg-emerald-400');
    expect(getStatusDotColor('failed')).toBe('bg-rose-400');
    expect(getStatusDotColor('scheduled')).toBe('bg-blue-400');
  });
});
