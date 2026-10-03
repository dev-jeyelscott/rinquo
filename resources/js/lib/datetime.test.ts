import { describe, expect, it } from 'vite-plus/test';
import { formatInstant } from '@/lib/datetime';

describe('formatInstant', () => {
    it('formats a UTC instant as Asia/Manila wall-clock time', () => {
        const formatted = formatInstant(
            '2026-01-15T01:30:00Z',
            'Asia/Manila',
            {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                hourCycle: 'h23',
            },
            'en-CA',
        );

        expect(formatted).toBe('2026-01-15, 09:30');
    });

    it('crosses the date boundary when Manila is already the next day', () => {
        const formatted = formatInstant(
            '2026-01-15T16:00:00Z',
            'Asia/Manila',
            { year: 'numeric', month: '2-digit', day: '2-digit' },
            'en-CA',
        );

        expect(formatted).toBe('2026-01-16');
    });

    it('rejects values that are not valid instants', () => {
        expect(() => formatInstant('not-a-date', 'Asia/Manila')).toThrow(
            RangeError,
        );
    });
});
