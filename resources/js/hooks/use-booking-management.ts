import { useForm } from '@inertiajs/react';
import { useEffect, useRef } from 'react';
import { uuid } from '@/lib/booking-format';

type Identity = { publicId: string; revision: number };

/**
 * The cancel and reschedule forms of one booking page, and the one rule that
 * keeps their idempotency keys honest: a key belongs to one booking at one
 * revision. When the same page is reused for another booking (a reschedule
 * lands on its replacement, which can start at the same revision) both keys
 * rotate and the typed reason, chosen time and old errors are dropped. A
 * revision refresh of the same booking rotates the keys but keeps what the
 * customer typed. A rejected key (`idempotency_key` error) is also rotated so
 * the next attempt is a new request, not a replay of a spent one.
 */
export function useBookingManagement(booking: Identity) {
    const cancellation = useForm({
        revision: booking.revision,
        idempotency_key: uuid(),
        reason: '',
        booking: '',
    });
    const reschedule = useForm({
        revision: booking.revision,
        idempotency_key: uuid(),
        start_at: '',
        booking: '',
    });
    const seen = useRef<Identity>(booking);

    useEffect(() => {
        const previous = seen.current;
        if (
            previous.publicId === booking.publicId &&
            previous.revision === booking.revision
        ) {
            return;
        }
        seen.current = {
            publicId: booking.publicId,
            revision: booking.revision,
        };
        const otherBooking = previous.publicId !== booking.publicId;
        cancellation.setData((data) => ({
            ...data,
            revision: booking.revision,
            idempotency_key: uuid(),
            ...(otherBooking ? { reason: '', booking: '' } : {}),
        }));
        reschedule.setData((data) => ({
            ...data,
            revision: booking.revision,
            idempotency_key: uuid(),
            ...(otherBooking ? { start_at: '', booking: '' } : {}),
        }));
        if (otherBooking) {
            cancellation.clearErrors();
            reschedule.clearErrors();
        }
        // The form helpers are stable per render; only the booking identity matters.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [booking.publicId, booking.revision]);

    // A rejected key is spent: the next attempt must be a different request.
    useEffect(() => {
        if (reschedule.errors.idempotency_key) {
            reschedule.setData('idempotency_key', uuid());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [reschedule.errors.idempotency_key]);
    useEffect(() => {
        if (cancellation.errors.idempotency_key) {
            cancellation.setData('idempotency_key', uuid());
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cancellation.errors.idempotency_key]);

    const conflict = Boolean(
        cancellation.errors.revision || reschedule.errors.revision,
    );
    const clearErrors = () => {
        cancellation.clearErrors();
        reschedule.clearErrors();
    };

    return { cancellation, reschedule, conflict, clearErrors };
}

export type BookingManagement = ReturnType<typeof useBookingManagement>;
