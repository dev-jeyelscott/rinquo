import { describe, expect, it } from 'vite-plus/test';
import { reasonLabel } from '@/lib/availability';
import { readableForeground } from '@/lib/color';
import { formatMinutes, weekdayLabel } from '@/lib/schedule';
import { slugify } from '@/lib/slug';

describe('slugify', () => {
    it('produces a lowercase hyphenated address', () => {
        expect(slugify('Spark Auto Wash & Detail!')).toBe(
            'spark-auto-wash-detail',
        );
        expect(slugify('  --Café  Noir-- ')).toBe('cafe-noir');
    });

    it('is bounded to 63 characters', () => {
        expect(slugify('a'.repeat(100))).toHaveLength(63);
    });
});

describe('readableForeground', () => {
    it('uses white on dark brand colors and dark text on light ones', () => {
        expect(readableForeground('#1E40AF')).toBe('#ffffff');
        expect(readableForeground('#FDE68A')).toBe('#0f172a');
    });

    it('falls back safely on invalid input', () => {
        expect(readableForeground('blue')).toBe('#ffffff');
    });
});

describe('schedule helpers', () => {
    it('formats minutes', () => {
        expect(formatMinutes(30)).toBe('30 min');
        expect(formatMinutes(60)).toBe('1 h');
        expect(formatMinutes(90)).toBe('1 h 30 min');
    });

    it('names weekdays with ISO numbering', () => {
        expect(weekdayLabel(1)).toBe('Monday');
        expect(weekdayLabel(7)).toBe('Sunday');
    });
});

describe('reasonLabel', () => {
    it('explains missing consumption and falls back to the raw key', () => {
        expect(reasonLabel('missing_consumption')).toMatch(/cannot be booked/);
        expect(reasonLabel('something_new')).toBe('something_new');
    });
});
