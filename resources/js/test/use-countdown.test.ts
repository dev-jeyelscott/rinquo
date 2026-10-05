import { act, renderHook } from '@testing-library/react';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vite-plus/test';
import { useCountdown } from '@/hooks/use-countdown';

describe('useCountdown', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('counts down to zero and stops', () => {
        const { result } = renderHook(() => useCountdown(3));
        expect(result.current).toBe(3);

        act(() => {
            vi.advanceTimersByTime(1000);
        });
        expect(result.current).toBe(2);

        act(() => {
            vi.advanceTimersByTime(5000);
        });
        expect(result.current).toBe(0);
    });

    it('starts at zero when there is no cooldown', () => {
        const { result } = renderHook(() => useCountdown(0));
        expect(result.current).toBe(0);
    });

    it('restarts when the cooldown is renewed', () => {
        const { result, rerender } = renderHook(({ s }) => useCountdown(s), {
            initialProps: { s: 1 },
        });
        act(() => {
            vi.advanceTimersByTime(2000);
        });
        expect(result.current).toBe(0);

        rerender({ s: 60 });
        expect(result.current).toBe(60);
    });
});
