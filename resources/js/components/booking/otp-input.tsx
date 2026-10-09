import { useEffect, useId, useRef } from 'react';
import type { ClipboardEvent, KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    value: string;
    onChange: (value: string) => void;
    /** Number of digits; the server's code length. */
    length?: number;
    label?: string;
    error?: string;
    disabled?: boolean;
    /** Focus the first cell when the group appears (the verification step opens). */
    autoFocus?: boolean;
};

/**
 * A one-time code as separate digit cells. Each cell is a real numeric input
 * inside a labelled group, so screen readers hear "Digit 3 of 6" and the group
 * name; the browser may fill the whole code through one-time-code autofill on
 * the first cell. Typing advances, Backspace steps back, arrows move between
 * cells and a pasted code is spread across them. Only digits are accepted and
 * the value is a plain digit string for the form.
 */
export function OtpInput({
    value,
    onChange,
    length = 6,
    label = '6-digit verification code',
    error,
    disabled,
    autoFocus,
}: Props) {
    const id = useId();
    const cells = useRef<(HTMLInputElement | null)[]>([]);
    const digits = Array.from({ length }, (_, index) => value[index] ?? '');
    const errorId = `${id}-error`;
    const labelId = `${id}-label`;

    // The first cell is where a new attempt starts: on open, and after a rejected code was cleared.
    useEffect(() => {
        if (autoFocus) {
            cells.current[0]?.focus();
        }
    }, [autoFocus]);
    useEffect(() => {
        if (error) {
            cells.current[0]?.focus();
        }
    }, [error]);

    function focusCell(index: number) {
        cells.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
    }

    function place(index: number, entered: string) {
        const incoming = entered.replace(/\D/g, '');

        if (incoming === '') {
            return;
        }

        const next = digits.slice();
        let cursor = index;
        for (const digit of incoming) {
            if (cursor >= length) {
                break;
            }
            next[cursor] = digit;
            cursor += 1;
        }

        onChange(next.join('').slice(0, length));
        focusCell(cursor);
    }

    function keyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
        if (event.key === 'Backspace') {
            event.preventDefault();
            const next = digits.slice();
            if (next[index] !== '') {
                next[index] = '';
                onChange(next.join(''));
            } else if (index > 0) {
                next[index - 1] = '';
                onChange(next.join(''));
                focusCell(index - 1);
            }
        } else if (event.key === 'ArrowLeft') {
            event.preventDefault();
            focusCell(index - 1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            focusCell(index + 1);
        }
    }

    function paste(index: number, event: ClipboardEvent<HTMLInputElement>) {
        event.preventDefault();
        place(index, event.clipboardData.getData('text'));
    }

    return (
        <div className="grid gap-2">
            <p id={labelId} className="text-sm font-medium">
                {label}
            </p>
            <div
                role="group"
                aria-labelledby={labelId}
                aria-describedby={error ? errorId : undefined}
                className="grid grid-cols-6 gap-2 sm:gap-3"
            >
                {digits.map((digit, index) => (
                    <input
                        key={index}
                        ref={(element) => {
                            cells.current[index] = element;
                        }}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        autoComplete={index === 0 ? 'one-time-code' : 'off'}
                        aria-label={`Digit ${index + 1} of ${length}`}
                        aria-invalid={error ? true : undefined}
                        disabled={disabled}
                        value={digit}
                        onChange={(event) => place(index, event.target.value)}
                        onKeyDown={(event) => keyDown(index, event)}
                        onPaste={(event) => paste(index, event)}
                        onFocus={(event) => event.target.select()}
                        className={cn(
                            'h-12 min-w-0 rounded-lg border border-booking-control bg-background text-center text-xl font-semibold tabular-nums shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 sm:h-14',
                            digit !== '' && 'border-primary',
                        )}
                    />
                ))}
            </div>
            {error ? (
                <p
                    id={errorId}
                    role="alert"
                    className="text-sm text-destructive"
                >
                    {error}
                </p>
            ) : null}
        </div>
    );
}
