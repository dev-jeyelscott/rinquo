<?php

namespace App\Modules\Booking\Actions;

use App\Modules\Booking\Events\BookingLifecycleChanged;
use App\Modules\Booking\Mail\BookingRequestExpiredMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Support\BookingNotifier;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Marks stale holds and pending requests expired and tells the customer.
 *
 * Capacity already frees at the expiry instant through the time predicate, so
 * this sweeper only tidies state and notifies. Each organization is processed
 * under its row lock with conditional updates, which makes the sweep idempotent
 * and safe to run concurrently or repeatedly; work per run is bounded.
 */
final class ExpireBookings
{
    private const ORGANIZATIONS_PER_RUN = 200;

    private const BOOKINGS_PER_ORGANIZATION = 500;

    /** @return array{holds: int, requests: int} */
    public function handle(?CarbonImmutable $now = null): array
    {
        $now ??= CarbonImmutable::now();
        $holds = 0;
        $requests = 0;

        $organizationIds = Hold::query()->where('status', Hold::ACTIVE)->where('expires_at', '<=', $now)->distinct()->limit(self::ORGANIZATIONS_PER_RUN)->pluck('organization_id')
            ->merge(Booking::query()->where('status', Booking::PENDING_APPROVAL)->where('pending_expires_at', '<=', $now)->distinct()->limit(self::ORGANIZATIONS_PER_RUN)->pluck('organization_id'))
            ->unique();

        foreach ($organizationIds as $organizationId) {
            DB::transaction(function () use ($organizationId, $now, &$holds, &$requests): void {
                if (Organization::query()->whereKey($organizationId)->lockForUpdate()->first() === null) {
                    return;
                }

                $holds += Hold::query()
                    ->where('organization_id', $organizationId)
                    ->where('status', Hold::ACTIVE)
                    ->where('expires_at', '<=', $now)
                    ->update(['status' => Hold::EXPIRED, 'updated_at' => $now]);

                $stale = Booking::query()
                    ->where('organization_id', $organizationId)
                    ->where('status', Booking::PENDING_APPROVAL)
                    ->where('pending_expires_at', '<=', $now)
                    ->orderBy('id')
                    ->limit(self::BOOKINGS_PER_ORGANIZATION)
                    ->lockForUpdate()
                    ->get(['id', 'public_id', 'contact_email']);

                foreach ($stale as $booking) {
                    $changed = Booking::query()
                        ->whereKey($booking->id)
                        ->where('status', Booking::PENDING_APPROVAL)
                        ->where('pending_expires_at', '<=', $now)
                        ->update(['status' => Booking::EXPIRED, 'expired_at' => $now, 'updated_at' => $now]);

                    if ($changed === 1) {
                        $requests++;
                        BookingLifecycleChanged::dispatch($booking->public_id);
                        BookingNotifier::queue($booking->contact_email, new BookingRequestExpiredMail($booking->id));
                    }
                }
            });
        }

        return ['holds' => $holds, 'requests' => $requests];
    }
}
