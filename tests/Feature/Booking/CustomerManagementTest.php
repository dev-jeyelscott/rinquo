<?php

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingLifecycleEvent;
use App\Modules\Booking\Models\Hold;
use App\Modules\Identity\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Tests\Support\Billing;
use Tests\Support\Shop;

function manageUrl(Booking $booking, array $query = []): string
{
    return route('bookings.show', ['shine', $booking->public_id]).($query === [] ? '' : '?'.http_build_query($query));
}

function managePayload(Booking $booking): array
{
    return ['revision' => $booking->fresh()->revision, 'idempotency_key' => (string) Str::uuid()];
}

function operationAttributes(string $state, string $localStart = '2026-10-06 10:00'): array
{
    $start = Shop::at($localStart);

    return match ($state) {
        Booking::CHECKED_IN => ['operational_state' => $state, 'checked_in_at' => $start->subMinutes(10)],
        Booking::IN_SERVICE => ['operational_state' => $state, 'checked_in_at' => $start->subMinutes(10), 'started_at' => $start, 'actual_resource_id' => null],
        Booking::COMPLETED => ['operational_state' => $state, 'checked_in_at' => $start->subMinutes(10), 'started_at' => $start, 'completed_at' => $start->addMinutes(60), 'capacity_release_at' => $start->addMinutes(70)],
        default => [],
    };
}

/** A confirmed booking in an operational state, with the actual resource the facts CHECK requires. */
function operationalBooking(Shop $shop, string $state, string $localStart = '2026-10-06 10:00'): Booking
{
    $attributes = operationAttributes($state, $localStart);
    if (array_key_exists('actual_resource_id', $attributes)) {
        $attributes['actual_resource_id'] = $shop->records->resource->id;
    }
    if ($state === Booking::COMPLETED) {
        $attributes['actual_resource_id'] = $shop->records->resource->id;
    }

    return $shop->booking($localStart, attributes: $attributes);
}

test('the customer booking carries operational progress and a customer-safe history without internals', function () {
    $shop = Shop::make();
    $booking = operationalBooking($shop, Booking::COMPLETED);
    $customer = User::query()->findOrFail($booking->customer_user_id);

    $response = $this->actingAs($customer)->withoutVite()->get(manageUrl($booking))->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->where('booking.progress.state', Booking::COMPLETED)
        ->where('booking.progress.delayed', false)
        ->whereNot('booking.progress.completedAt', null)
        ->where('booking.actions.canCancel', false)
        ->where('booking.actions.canReschedule', false)
        ->where('booking.history.0.kind', 'confirmed')
        ->where('booking.history.1.kind', 'checked_in')
        ->where('booking.history.2.kind', 'in_service')
        ->where('booking.history.3.kind', 'completed')
        ->missing('booking.id')
        ->missing('booking.resource')
        ->missing('booking.bufferMinutes'));

    $payload = json_encode($response->viewData('page')['props']['booking'], JSON_THROW_ON_ERROR);
    foreach (['resource', 'capacity', 'units', 'actual_resource', 'buffer', 'actor', 'policy', 'staff'] as $internal) {
        expect($payload)->not->toContain($internal);
    }
});

test('delay is derived from the projection and only beyond five minutes', function () {
    $shop = Shop::make();
    // Checked in and still waiting 4 minutes past the appointment time: not delayed.
    $this->travelTo(Shop::at('2026-10-06 10:04'));
    $waiting = $shop->booking('2026-10-06 10:00', attributes: operationAttributes(Booking::CHECKED_IN));
    $customer = User::query()->findOrFail($waiting->customer_user_id);
    $this->actingAs($customer)->withoutVite()->get(manageUrl($waiting))->assertInertia(fn ($page) => $page
        ->where('booking.progress.state', Booking::CHECKED_IN)->where('booking.progress.delayed', false)->where('booking.progress.delayMinutes', 0));

    // 12 minutes late: presented as delayed, the stored state is still checked in.
    $this->travelTo(Shop::at('2026-10-06 10:12'));
    $this->actingAs($customer)->withoutVite()->get(manageUrl($waiting))->assertInertia(fn ($page) => $page
        ->where('booking.progress.state', Booking::CHECKED_IN)->where('booking.progress.delayed', true)->where('booking.progress.delayMinutes', 12));
    expect($waiting->fresh()->operational_state)->toBe(Booking::CHECKED_IN);

    // Service that started 8 minutes late projects an end 8 minutes late.
    $late = $shop->booking('2026-10-06 14:00', attributes: ['operational_state' => Booking::IN_SERVICE, 'checked_in_at' => Shop::at('2026-10-06 13:50'), 'started_at' => Shop::at('2026-10-06 14:08'), 'actual_resource_id' => $shop->records->resource->id]);
    $this->actingAs(User::query()->findOrFail($late->customer_user_id))->withoutVite()->get(manageUrl($late))->assertInertia(fn ($page) => $page
        ->where('booking.progress.state', Booking::IN_SERVICE)->where('booking.progress.delayed', true)->where('booking.progress.delayMinutes', 8)
        ->whereNot('booking.progress.projectedEndAt', null));
});

test('work in service, completed or a no-show exposes no self-service action and rejects the mutations', function (string $state) {
    $shop = Shop::make();
    $booking = $state === Booking::NO_SHOW
        ? $shop->booking('2026-10-06 10:00', attributes: ['operational_state' => $state, 'no_show_at' => Shop::at('2026-10-06 11:00'), 'capacity_release_at' => Shop::at('2026-10-06 11:00')])
        : operationalBooking($shop, $state);
    $customer = User::query()->findOrFail($booking->customer_user_id);

    $this->actingAs($customer)->withoutVite()->get(manageUrl($booking))->assertInertia(fn ($page) => $page
        ->where('booking.actions.canCancel', false)->where('booking.actions.canReschedule', false));
    $this->actingAs($customer)->post(route('bookings.cancel', ['shine', $booking->public_id]), managePayload($booking))->assertSessionHasErrors('booking');
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $booking->public_id]), managePayload($booking) + ['start_at' => Shop::at('2026-10-06 14:00')->toIso8601String()])->assertSessionHasErrors('booking');

    expect($booking->fresh()->status)->toBe(Booking::CONFIRMED)->and(Booking::query()->count())->toBe(1)->and(BookingLifecycleEvent::query()->count())->toBe(0);
})->with([Booking::IN_SERVICE, Booking::COMPLETED, Booking::NO_SHOW]);

test('rescheduling carries the vehicle make and model to the replacement hold and booking', function () {
    $shop = Shop::make();
    $source = $shop->booking('2026-10-06 10:00', attributes: ['vehicle_make_model' => 'Toyota Vios']);
    $customer = User::query()->findOrFail($source->customer_user_id);

    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), managePayload($source) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])->assertSessionHasNoErrors();
    $replacement = Booking::query()->findOrFail($source->fresh()->rescheduled_to_booking_id);

    expect($replacement->vehicle_make_model)->toBe('Toyota Vios')
        ->and(Hold::query()->findOrFail($replacement->hold_id)->vehicle_make_model)->toBe('Toyota Vios')
        ->and($replacement->total_price_centavos)->toBe($source->total_price_centavos);
    $this->actingAs($customer)->withoutVite()->get(manageUrl($replacement))->assertInertia(fn ($page) => $page
        ->where('booking.vehicleMakeModel', 'Toyota Vios')
        ->where('booking.rescheduledFrom.publicId', $source->public_id));
    $this->actingAs($customer)->withoutVite()->get(manageUrl($source))->assertInertia(fn ($page) => $page
        ->where('booking.status', Booking::RESCHEDULED)
        ->where('booking.rescheduledTo.publicId', $replacement->public_id)
        ->where('booking.history.1.kind', 'rescheduled'));
});

test('a customer can reschedule twice, each with its own key', function () {
    $shop = Shop::make();
    $source = $shop->booking('2026-10-06 10:00');
    $customer = User::query()->findOrFail($source->customer_user_id);

    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $source->public_id]), managePayload($source) + ['start_at' => Shop::at('2026-10-06 12:00')->toIso8601String()])->assertSessionHasNoErrors();
    $first = Booking::query()->findOrFail($source->fresh()->rescheduled_to_booking_id);
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $first->public_id]), managePayload($first) + ['start_at' => Shop::at('2026-10-06 14:00')->toIso8601String()])->assertSessionHasNoErrors();

    expect($first->fresh()->status)->toBe(Booking::RESCHEDULED)
        ->and(Booking::query()->where('status', Booking::CONFIRMED)->sole()->scheduled_start_at->equalTo(Shop::at('2026-10-06 14:00')))->toBeTrue();
});

test('replacement availability is server authored from the booked snapshot span and shows only booleans', function () {
    $shop = Shop::make(capacity: 1);
    // Booked as 120 + 10 minutes; the catalogue now says 60 + 10, so only the snapshot span is right.
    $source = $shop->booking('2026-10-07 10:00', minutes: 130);
    $shop->booking('2026-10-06 13:15');
    $customer = User::query()->findOrFail($source->customer_user_id);

    $response = $this->actingAs($customer)->withoutVite()->get(manageUrl($source, ['date' => '2026-10-06']))->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->has('replacementDates')
        ->where('replacementAvailability.date', '2026-10-06')
        ->where('replacementAvailability.closed', false)
        ->has('replacementNext.startAt'));
    $times = collect($response->viewData('page')['props']['replacementAvailability']['times'])
        ->mapWithKeys(fn (array $time): array => [CarbonImmutable::parse($time['startAt'])->setTimezone('Asia/Manila')->format('H:i') => $time['available']]);

    expect($times['10:00'])->toBeTrue()->and($times['12:00'])->toBeFalse()->and($times['15:00'])->toBeTrue();
    foreach ($response->viewData('page')['props']['replacementAvailability']['times'] as $time) {
        expect(array_keys($time))->toBe(['startAt', 'available']);
    }
});

test('replacement availability is withheld when rescheduling cannot be attempted and stays owner scoped', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');
    $other = User::query()->findOrFail($shop->booking('2026-10-06 12:00')->customer_user_id);
    $customer = User::query()->findOrFail($booking->customer_user_id);

    $this->actingAs($other)->withoutVite()->get(manageUrl($booking, ['date' => '2026-10-06']))->assertNotFound();
    $this->actingAs($customer)->withoutVite()->get(manageUrl($booking, ['date' => '2025-01-01']))->assertSessionHasErrors('date');
    $this->actingAs($customer)->withoutVite()->get(manageUrl($booking, ['date' => 'nonsense']))->assertSessionHasErrors('date');

    $shop->organization->forceFill(['published_at' => null])->save();
    $this->actingAs($customer)->withoutVite()->get(manageUrl($booking, ['date' => '2026-10-06']))->assertOk()->assertInertia(fn ($page) => $page
        ->where('replacementDates', null)->where('replacementAvailability', null)->where('replacementNext', null));
});

test('without a chosen date the day of the next available time opens first', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');
    $customer = User::query()->findOrFail($booking->customer_user_id);

    $response = $this->actingAs($customer)->withoutVite()->get(manageUrl($booking))->assertOk();
    $props = $response->viewData('page')['props'];
    $nextDay = CarbonImmutable::parse($props['replacementNext']['startAt'])->setTimezone('Asia/Manila')->toDateString();

    expect($props['replacementAvailability']['date'])->toBe($nextDay)
        ->and(collect($props['replacementAvailability']['times'])->contains('available', true))->toBeTrue();
});

test('viewing a booking whose add-on was archived still renders, keeps cancel and withdraws reschedule', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');
    $addOn = $shop->addOn();
    DB::table('booking_add_ons')->insert(['organization_id' => $booking->organization_id, 'booking_id' => $booking->id, 'add_on_id' => $addOn->id, 'name' => 'Wax', 'price_centavos' => 15000, 'duration_minutes' => 20, 'created_at' => now(), 'updated_at' => now()]);
    $customer = User::query()->findOrFail($booking->customer_user_id);
    DB::table('add_ons')->where('id', $addOn->id)->update(['archived_at' => now()]);

    $this->actingAs($customer)->withoutVite()->get(manageUrl($booking))->assertOk()->assertInertia(fn ($page) => $page
        ->where('booking.actions.canCancel', true)
        ->where('booking.actions.canReschedule', false)
        ->whereNot('booking.actions.rescheduleReason', null)
        ->where('replacementDates', null));

    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $booking->public_id]), [...managePayload($booking), 'start_at' => Shop::at('2026-10-07 10:00')->utc()->toIso8601String()])
        ->assertSessionHasErrors('start_at');
    expect($booking->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('a passed change deadline exposes when it closed, and an open one does not', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-06 10:00');
    $customer = User::query()->findOrFail($booking->customer_user_id);

    $this->actingAs($customer)->withoutVite()->get(manageUrl($booking))->assertOk()->assertInertia(fn ($page) => $page
        ->where('booking.actions.closedAt', null)->where('booking.actions.restricted', false)->whereNot('booking.actions.deadlineAt', null));

    $closedAt = $booking->scheduled_start_at->subMinutes((int) $booking->policy_snapshot['min_notice_minutes'])->utc()->toIso8601String();
    $this->travelTo($booking->scheduled_start_at->subMinute());

    $this->actingAs($customer)->withoutVite()->get(manageUrl($booking))->assertOk()->assertInertia(fn ($page) => $page
        ->where('booking.actions.canCancel', false)->where('booking.actions.deadlineAt', null)->where('booking.actions.closedAt', $closedAt));
});

test('a restricted shop flags the booking as limited without saying why', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-07 10:00');
    $customer = User::query()->findOrFail($booking->customer_user_id);
    Billing::restrict($shop->organization);

    $this->actingAs($customer)->withoutVite()->get(manageUrl($booking))->assertOk()->assertInertia(fn ($page) => $page
        ->where('booking.actions.restricted', true)->where('booking.actions.canCancel', true)
        ->where('booking.actions.rescheduleReason', 'This shop is not accepting new bookings or replacement times. Your existing booking remains confirmed.'));
});
