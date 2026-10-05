<?php

use App\Modules\Booking\Actions\ExpireBookings;
use App\Modules\Booking\Events\BookingLifecycleChanged;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingLifecycleEvent;
use App\Modules\Booking\Models\Hold;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\AuditEvent;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Tests\Support\Shop;

function lifecyclePayload(Booking $booking): array
{
    return ['revision' => $booking->fresh()->revision, 'idempotency_key' => (string) Str::uuid()];
}

test('a customer cancellation is lifecycle-audited and idempotent', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');
    $customer = User::query()->findOrFail($booking->customer_user_id);
    $payload = lifecyclePayload($booking) + ['reason' => 'Travel plans changed'];

    $this->actingAs($customer)->post(route('bookings.cancel', ['shine', $booking->public_id]), $payload)
        ->assertRedirect(route('bookings.show', ['shine', $booking->public_id]));
    $this->actingAs($customer)->post(route('bookings.cancel', ['shine', $booking->public_id]), $payload)
        ->assertRedirect(route('bookings.show', ['shine', $booking->public_id]));

    expect($booking->fresh()->status)->toBe(Booking::CANCELLED)
        ->and(BookingLifecycleEvent::query()->where('booking_id', $booking->id)->count())->toBe(1)
        ->and(AuditEvent::query()->where('action', 'booking.cancel')->count())->toBe(1);
});

test('a stale revision and cutoff reject customer cancellation', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-05 09:00'); // Starts exactly at the 60-minute policy cutoff (08:00).
    $customer = User::query()->findOrFail($booking->customer_user_id);

    $this->actingAs($customer)->post(route('bookings.cancel', ['shine', $booking->public_id]), lifecyclePayload($booking))
        ->assertSessionHasErrors('booking');
    expect($booking->fresh()->status)->toBe(Booking::CONFIRMED);

    $future = $shop->booking('2026-10-06 11:00');
    $payload = lifecyclePayload($future);
    $this->actingAs(User::query()->findOrFail($future->customer_user_id))
        ->post(route('bookings.cancel', ['shine', $future->public_id]), ['revision' => 99] + $payload)
        ->assertSessionHasErrors('revision');
});

test('reschedule secures a replacement before terminalizing the source', function () {
    $shop = Shop::make();
    $source = $shop->booking('2026-10-06 10:00');
    $customer = User::query()->findOrFail($source->customer_user_id);

    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), lifecyclePayload($source) + [
        'start_at' => Shop::at('2026-10-06 12:00')->toIso8601String(),
    ])->assertRedirect();

    $replacement = Booking::query()->where('id', '!=', $source->id)->sole();
    expect($source->fresh()->status)->toBe(Booking::RESCHEDULED)
        ->and($source->fresh()->rescheduled_to_booking_id)->toBe($replacement->id)
        ->and($replacement->status)->toBe(Booking::CONFIRMED)
        ->and($replacement->scheduled_start_at->equalTo(Shop::at('2026-10-06 12:00')))->toBeTrue();
});

test('the change deadline is inclusive at the cutoff and open one minute earlier', function () {
    $shop = Shop::make();
    $atCutoff = $shop->booking('2026-10-05 09:00');
    $justBefore = $shop->booking('2026-10-05 09:01');

    $this->actingAs(User::query()->findOrFail($atCutoff->customer_user_id))
        ->post(route('bookings.reschedule', ['shine', $atCutoff->public_id]), lifecyclePayload($atCutoff) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])
        ->assertSessionHasErrors('booking');
    $this->actingAs(User::query()->findOrFail($justBefore->customer_user_id))
        ->post(route('bookings.cancel', ['shine', $justBefore->public_id]), lifecyclePayload($justBefore))
        ->assertSessionHasNoErrors();

    expect($atCutoff->fresh()->status)->toBe(Booking::CONFIRMED)
        ->and($justBefore->fresh()->status)->toBe(Booking::CANCELLED);
});

test('terminal and lapsed bookings reject every customer lifecycle transition', function (string $status, array $attributes) {
    $shop = Shop::make();
    if ($status === Booking::CANCELLED) {
        $attributes += ['cancelled_at' => now(), 'cancelled_by_user_id' => $shop->owner->id];
    }
    if ($status === Booking::RESCHEDULED) {
        $attributes += ['rescheduled_to_booking_id' => $shop->booking('2026-10-06 14:00')->id];
    }
    $booking = $shop->booking('2026-10-06 10:00', $status, attributes: $attributes);
    $customer = User::query()->findOrFail($booking->customer_user_id);
    $before = $booking->fresh();
    $bookings = Booking::query()->count();

    $this->actingAs($customer)->post(route('bookings.cancel', ['shine', $booking->public_id]), lifecyclePayload($booking))
        ->assertSessionHasErrors('booking');
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $booking->public_id]), lifecyclePayload($booking) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])
        ->assertSessionHasErrors('booking');

    expect($booking->fresh()->status)->toBe($status)
        ->and($booking->fresh()->revision)->toBe($before->revision)
        ->and(Booking::query()->count())->toBe($bookings)
        ->and(BookingLifecycleEvent::query()->count())->toBe(0);
})->with([
    'cancelled' => [Booking::CANCELLED, []],
    'rescheduled' => [Booking::RESCHEDULED, []],
    'declined' => [Booking::DECLINED, []],
    'expired' => [Booking::EXPIRED, []],
    'lapsed pending request' => [Booking::PENDING_APPROVAL, ['pending_expires_at' => Shop::at('2026-10-05 07:00')]],
]);

test('a customer cannot act on another customer booking', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');
    $other = $shop->booking('2026-10-06 12:00');
    $stranger = User::query()->findOrFail($other->customer_user_id);

    $this->actingAs($stranger)->post(route('bookings.cancel', ['shine', $booking->public_id]), lifecyclePayload($booking))->assertNotFound();
    expect($booking->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('a restricted shop still lets the customer cancel but blocks rescheduling', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');
    $customer = User::query()->findOrFail($booking->customer_user_id);
    $shop->organization->forceFill(['published_at' => null])->save();

    $this->actingAs($customer)->withoutVite()->get(route('bookings.show', ['shine', $booking->public_id]))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('booking.actions.canCancel', true)
            ->where('booking.actions.canReschedule', false)
            ->whereNot('booking.actions.rescheduleReason', null));
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $booking->public_id]), lifecyclePayload($booking) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])
        ->assertNotFound();
    expect($booking->fresh()->status)->toBe(Booking::CONFIRMED);

    $this->actingAs($customer)->post(route('bookings.cancel', ['shine', $booking->public_id]), lifecyclePayload($booking))
        ->assertRedirect(route('bookings.show', ['shine', $booking->public_id]));
    expect($booking->fresh()->status)->toBe(Booking::CANCELLED);
});

test('a reschedule into an unavailable time leaves the original booking untouched', function () {
    $shop = Shop::make(capacity: 1);
    $source = $shop->booking('2026-10-06 10:00');
    $shop->booking('2026-10-06 12:00'); // Fills the only unit at the requested time.
    $customer = User::query()->findOrFail($source->customer_user_id);

    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), lifecyclePayload($source) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])
        ->assertSessionHasErrors('start_at');

    expect($source->fresh()->status)->toBe(Booking::CONFIRMED)
        ->and($source->fresh()->rescheduled_to_booking_id)->toBeNull()
        ->and(Booking::query()->count())->toBe(2)
        ->and(BookingLifecycleEvent::query()->count())->toBe(0);
});

test('a repeated or competing reschedule creates exactly one replacement', function () {
    $shop = Shop::make();
    $source = $shop->booking('2026-10-06 10:00');
    $customer = User::query()->findOrFail($source->customer_user_id);
    $payload = lifecyclePayload($source) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()];

    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), $payload)->assertRedirect();
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), $payload)->assertRedirect();
    // A second racer holding the old revision, with a fresh key, loses against the terminal source.
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), ['idempotency_key' => (string) Str::uuid()] + $payload)
        ->assertSessionHasErrors('revision');
    $this->actingAs($customer)->post(route('bookings.cancel', ['shine', $source->public_id]), ['idempotency_key' => (string) Str::uuid(), 'revision' => 1])
        ->assertSessionHasErrors('revision');

    expect(Booking::query()->count())->toBe(2)
        ->and($source->fresh()->status)->toBe(Booking::RESCHEDULED)
        ->and(BookingLifecycleEvent::query()->where('booking_id', $source->id)->count())->toBe(1);
});

test('an idempotency key cannot be reused for a different action', function () {
    $shop = Shop::make();
    $source = $shop->booking('2026-10-06 10:00');
    $customer = User::query()->findOrFail($source->customer_user_id);
    $payload = lifecyclePayload($source);

    $this->actingAs($customer)->post(route('bookings.cancel', ['shine', $source->public_id]), $payload)->assertSessionHasNoErrors();
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), $payload + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])
        ->assertSessionHasErrors('idempotency_key');
});

test('operators cancel with a mandatory reason and an audit trail; customers cannot use the operator route', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');
    $staff = $shop->member('staff');
    $route = route('owner.booking-requests.cancel', [$shop->organization, $booking->public_id]);

    $this->actingAs($staff)->post($route, lifecyclePayload($booking))->assertSessionHasErrors('reason');
    $this->actingAs(User::query()->findOrFail($booking->customer_user_id))->post($route, lifecyclePayload($booking) + ['reason' => 'x'])->assertNotFound();
    expect($booking->fresh()->status)->toBe(Booking::CONFIRMED);

    $this->actingAs($staff)->post($route, lifecyclePayload($booking) + ['reason' => 'Bay is closed'])->assertSessionHasNoErrors();

    $event = BookingLifecycleEvent::query()->where('booking_id', $booking->id)->sole();
    expect($booking->fresh()->status)->toBe(Booking::CANCELLED)
        ->and($event->reason)->toBe('Bay is closed')
        ->and($event->actor_user_id)->toBe($staff->id)
        ->and(AuditEvent::query()->where('action', 'booking.cancel')->count())->toBe(1);
});

test('lifecycle changes broadcast a PII-free nudge on the private booking channel after commit', function () {
    Event::fake([BookingLifecycleChanged::class]);
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');

    $this->actingAs(User::query()->findOrFail($booking->customer_user_id))
        ->post(route('bookings.cancel', ['shine', $booking->public_id]), lifecyclePayload($booking));

    Event::assertDispatched(BookingLifecycleChanged::class, function (BookingLifecycleChanged $event) use ($booking): bool {
        return $event->bookingPublicId === $booking->public_id
            && $event->broadcastOn()->name === 'private-booking.'.$booking->public_id
            && $event->broadcastWith() === [];
    });
});

test('expiring a pending request nudges its channel', function () {
    Event::fake([BookingLifecycleChanged::class]);
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00', Booking::PENDING_APPROVAL, attributes: ['pending_expires_at' => Shop::at('2026-10-05 07:00')]);

    app(ExpireBookings::class)->handle();

    Event::assertDispatched(BookingLifecycleChanged::class, fn (BookingLifecycleChanged $event): bool => $event->bookingPublicId === $booking->public_id);
});

test('only the owning customer is authorized for the private booking channel', function () {
    config(['broadcasting.default' => 'reverb']);
    Broadcast::purge('reverb');
    require base_path('routes/channels.php'); // Registers the callbacks on the reverb broadcaster used by this test.
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');
    $auth = fn (User $user) => $this->actingAs($user)->post('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'private-booking.'.$booking->public_id]);

    $auth(User::query()->findOrFail($booking->customer_user_id))->assertOk()->assertJsonStructure(['auth']);
    $auth($shop->owner)->assertForbidden();
    $auth($shop->member('staff'))->assertForbidden();
});

test('rescheduling checks and stores the booked service span even when the catalogue duration shrank', function () {
    $shop = Shop::make(capacity: 1);
    // Booked as a 120 + 10 minute service; the catalogue now says 60 + 10.
    $source = $shop->booking('2026-10-07 10:00', minutes: 130);
    $shop->booking('2026-10-06 13:15'); // Occupies 13:15-14:25 on the only bay.
    $customer = User::query()->findOrFail($source->customer_user_id);

    // 12:00 + 130 minutes would overlap the 13:15 booking: it must be refused.
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), lifecyclePayload($source) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])
        ->assertSessionHasErrors('start_at');
    expect($source->fresh()->status)->toBe(Booking::CONFIRMED);

    // 10:00 + 130 minutes ends at 12:10: allowed, and the booking and hold agree on the span.
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), lifecyclePayload($source) + ['start_at' => Shop::at('2026-10-06 10:00')->toIso8601String()])
        ->assertSessionHasNoErrors();
    $replacement = Booking::query()->findOrFail($source->fresh()->rescheduled_to_booking_id);
    $hold = Hold::query()->findOrFail($replacement->hold_id);
    expect($replacement->occupied_end_at->equalTo(Shop::at('2026-10-06 12:10')))->toBeTrue()
        ->and($hold->occupied_end_at->equalTo($replacement->occupied_end_at))->toBeTrue()
        ->and($hold->service_end_at->equalTo($replacement->service_end_at))->toBeTrue();
});

test('rescheduling a confirmed staff-approval booking keeps it confirmed and never expires it', function () {
    $shop = Shop::make();
    $source = $shop->booking('2026-10-06 10:00', attributes: ['approval_mode' => 'staff_approval']);
    $customer = User::query()->findOrFail($source->customer_user_id);

    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), lifecyclePayload($source) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])
        ->assertSessionHasNoErrors();
    $replacement = Booking::query()->findOrFail($source->fresh()->rescheduled_to_booking_id);
    $this->travel(3)->hours();
    app(ExpireBookings::class)->handle();

    expect($replacement->status)->toBe(Booking::CONFIRMED)
        ->and($replacement->pending_expires_at)->toBeNull()
        ->and($replacement->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('rescheduling a pending request keeps it pending on its original deadline', function () {
    $shop = Shop::make();
    $source = $shop->booking('2026-10-06 10:00', Booking::PENDING_APPROVAL, attributes: ['approval_mode' => 'staff_approval', 'pending_expires_at' => Shop::at('2026-10-05 09:00')]);
    $customer = User::query()->findOrFail($source->customer_user_id);

    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), lifecyclePayload($source) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])
        ->assertSessionHasNoErrors();
    $replacement = Booking::query()->findOrFail($source->fresh()->rescheduled_to_booking_id);

    expect($replacement->status)->toBe(Booking::PENDING_APPROVAL)
        ->and($replacement->pending_expires_at->equalTo(Shop::at('2026-10-05 09:00')))->toBeTrue();
});

test('the database rejects reschedule lineage across organizations and incoherent terminal rows', function () {
    $shop = Shop::make();
    $other = Shop::make('other');
    $source = $shop->booking('2026-10-06 10:00');
    $foreign = $other->booking('2026-10-06 10:00');
    $sameOrg = $shop->booking('2026-10-06 12:00');

    $update = fn (array $values) => fn () => DB::transaction(fn () => DB::table('bookings')->where('id', $source->id)->update($values));

    expect($update(['status' => 'rescheduled', 'rescheduled_to_booking_id' => $foreign->id]))->toThrow(QueryException::class)
        ->and($update(['status' => 'rescheduled', 'rescheduled_to_booking_id' => null]))->toThrow(QueryException::class)
        ->and($update(['status' => 'rescheduled', 'rescheduled_to_booking_id' => $source->id]))->toThrow(QueryException::class)
        ->and($update(['status' => 'confirmed', 'rescheduled_to_booking_id' => $sameOrg->id]))->toThrow(QueryException::class)
        ->and($update(['status' => 'cancelled', 'cancelled_at' => null]))->toThrow(QueryException::class);
});
