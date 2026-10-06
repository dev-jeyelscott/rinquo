<?php

use App\Modules\Booking\Actions\ConfirmBooking;
use App\Modules\Booking\Actions\PlaceHold;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\OrganizationClosure;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Billing;
use Tests\Support\Journey;
use Tests\Support\Shop;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
    $this->gateway = Billing::fake();
});

function operate(Shop $shop, Booking $booking, string $operation, array $data = [])
{
    $payload = ['revision' => $booking->fresh()->operation_revision, 'idempotency_key' => (string) Str::uuid()] + $data;

    return test()->actingAs($shop->member(Membership::STAFF))->post(route("owner.operations.bookings.{$operation}", [$shop->organization, $booking->public_id]), $payload);
}

function staffWalkIn(Shop $shop)
{
    return test()->actingAs($shop->member(Membership::STAFF))->post(route('owner.operations.bookings.store', $shop->organization), [
        'idempotency_key' => (string) Str::uuid(), 'mode' => 'walk_in', 'vehicle_type_id' => $shop->records->vehicle->id, 'service_id' => $shop->records->service->id,
        'add_on_ids' => [], 'contact_name' => 'Walk-in', 'contact_phone' => '0917 000 0000',
    ]);
}

function customerCancel(Booking $booking)
{
    $customer = User::query()->findOrFail($booking->customer_user_id);

    return test()->actingAs($customer)->post(route('bookings.cancel', ['shine', $booking->public_id]), ['revision' => $booking->fresh()->revision, 'idempotency_key' => (string) Str::uuid()]);
}

test('an organization in trial, paid and grace takes bookings; restriction begins exactly at grace end', function () {
    $shop = Shop::make();
    $graceEnds = now()->addMinutes(30);
    Billing::set($shop->organization, now()->subDays(40), now()->subDays(10), $graceEnds);

    Journey::placeHold($shop, '2026-10-06 10:00')->assertSessionHasNoErrors();

    $this->travelTo($graceEnds->subSecond());
    Journey::placeHold($shop, '2026-10-06 12:00')->assertSessionHasNoErrors();

    $this->travelTo($graceEnds);
    Journey::placeHold($shop, '2026-10-06 14:00')->assertNotFound();
});

test('a restricted shop keeps its public page but reports unavailable and takes no holds or wizard visits', function () {
    $shop = Shop::make();
    Billing::restrict($shop->organization);

    $this->get(route('shops.show', 'shine'))->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('shops/show')->where('bookingAvailable', false)
        ->where('bookingUnavailableReason', fn ($reason) => str_contains($reason, 'not taking new bookings')));
    $this->get(route('bookings.wizard', 'shine'))->assertNotFound();
    Journey::placeHold($shop)->assertNotFound();

    expect(Hold::query()->count())->toBe(0)->and($shop->organization->fresh()->published_at)->not->toBeNull();
});

test('a stale already-loaded form cannot create or confirm a booking after the boundary', function () {
    $shop = Shop::make();
    $graceEnds = now()->addMinutes(30);
    Billing::set($shop->organization, now()->subDays(40), now()->subDays(10), $graceEnds);
    $customer = Tenant::user('late@example.test');
    $this->actingAs($customer);
    $hold = Journey::hold($shop, '2026-10-06 10:00');
    Journey::saveDetails($shop, $hold)->assertSessionHasNoErrors();

    $this->travelTo($graceEnds->addSecond());
    Journey::confirm($shop, $hold->fresh())->assertNotFound();

    expect(Booking::query()->count())->toBe(0);
});

test('the confirm action itself refuses a held time once the organization is restricted', function () {
    $shop = Shop::make();
    $customer = Tenant::user('confirmer@example.test');
    $this->actingAs($customer);
    $hold = Journey::hold($shop, '2026-10-06 10:00');
    Journey::saveDetails($shop, $hold)->assertSessionHasNoErrors();
    Billing::restrict($shop->organization);

    // The HTTP route 404s first; the locked domain action is the authoritative second gate.
    $hold->forceFill(['session_token_hash' => hash('sha256', 'direct')])->save();
    expect(fn () => app(ConfirmBooking::class)->handle($shop->organization, $hold->public_id, 'direct', $customer))
        ->toThrow(ValidationException::class, 'not taking new bookings');
    expect(Booking::query()->count())->toBe(0);
});

test('the shared intake gate rejects a restricted shop with a specific error under the lock', function () {
    $shop = Shop::make();
    Billing::restrict($shop->organization);

    expect(fn () => app(PlaceHold::class)->handle(
        $shop->organization, (string) Str::uuid(), $shop->records->vehicle->id, $shop->records->service->id, [], Shop::at('2026-10-06 10:00'), Str::random(40),
    ))->toThrow(ValidationException::class, 'not taking new bookings');
});

test('staff walk-ins and appointments are refused once restricted, and work again after renewal', function () {
    $shop = Shop::make();
    staffWalkIn($shop)->assertSessionHasNoErrors();
    Billing::restrict($shop->organization);

    staffWalkIn($shop)->assertSessionHasErrors('access');
    $this->actingAs($shop->member(Membership::STAFF))->post(route('owner.operations.bookings.store', $shop->organization), [
        'idempotency_key' => (string) Str::uuid(), 'mode' => 'scheduled', 'vehicle_type_id' => $shop->records->vehicle->id, 'service_id' => $shop->records->service->id,
        'add_on_ids' => [], 'contact_name' => 'Later', 'start_at' => Shop::at('2026-10-06 10:00')->toIso8601String(),
    ])->assertSessionHasErrors('access');
    expect(Booking::query()->count())->toBe(1);

    renewAndPay($shop);
    staffWalkIn($shop)->assertSessionHasNoErrors();
    expect(Booking::query()->count())->toBe(2);
});

function renewAndPay(Shop $shop): void
{
    test()->actingAs($shop->owner)->post(route('owner.settings.billing.renewal', $shop->organization))->assertSessionHasNoErrors();
    $request = PaymentRequest::query()->where('organization_id', $shop->organization->id)->where('status', 'open')->sole();
    Billing::deliver(Billing::paidEvent($request))->assertOk();
}

test('customer rescheduling is blocked with an explanation while cancelling stays available', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-07 10:00');
    $customer = User::query()->findOrFail($booking->customer_user_id);
    Billing::restrict($shop->organization);

    $this->actingAs($customer)->withoutVite()->get(route('bookings.show', ['shine', $booking->public_id]))->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->where('booking.actions.canCancel', true)->where('booking.actions.canReschedule', false)
            ->where('booking.actions.rescheduleReason', fn ($reason) => str_contains($reason, 'You can still cancel')));
    $this->actingAs($customer)->post(route('bookings.reschedule', ['shine', $booking->public_id]), [
        'revision' => $booking->fresh()->revision, 'idempotency_key' => (string) Str::uuid(), 'start_at' => Shop::at('2026-10-07 12:00')->toIso8601String(),
    ])->assertSessionHasErrors('access');
    expect($booking->fresh()->status)->toBe(Booking::CONFIRMED);

    customerCancel($booking)->assertSessionHasNoErrors();
    expect($booking->fresh()->status)->toBe(Booking::CANCELLED);
});

test('every existing-booking staff operation still works while restricted', function () {
    $shop = Shop::make();
    $first = $shop->booking('2026-10-05 10:00');
    $second = $shop->booking('2026-10-05 08:10');
    $pending = $shop->booking('2026-10-06 10:00', Booking::PENDING_APPROVAL, attributes: ['approval_mode' => 'staff_approval']);
    $declined = $shop->booking('2026-10-06 12:00', Booking::PENDING_APPROVAL, attributes: ['approval_mode' => 'staff_approval']);
    Billing::restrict($shop->organization);

    operate($shop, $first, 'check-in')->assertSessionHasNoErrors();
    operate($shop, $first, 'start')->assertSessionHasNoErrors();
    $this->travel(80)->minutes();
    Billing::restrict($shop->organization, now()->subMinute());
    operate($shop, $first, 'complete')->assertSessionHasNoErrors();
    operate($shop, $second, 'no-show', ['confirm' => 1, 'reason' => 'Did not arrive'])->assertSessionHasNoErrors();
    $this->actingAs($shop->owner)->post(route('owner.booking-requests.approve', [$shop->organization, $pending->public_id]))->assertSessionHasNoErrors();
    $this->actingAs($shop->owner)->post(route('owner.booking-requests.decline', [$shop->organization, $declined->public_id]))->assertSessionHasNoErrors();

    expect($first->fresh()->operational_state)->toBe(Booking::COMPLETED)
        ->and($second->fresh()->operational_state)->toBe(Booking::NO_SHOW)
        ->and($pending->fresh()->status)->toBe(Booking::CONFIRMED)
        ->and($declined->fresh()->status)->toBe(Booking::DECLINED);
});

test('restriction never rewrites a booking, clears publication or deactivates a membership', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-07 10:00');
    $staff = $shop->member(Membership::STAFF);
    $before = $booking->fresh()->getAttributes();
    $published = $shop->organization->fresh()->published_at;
    $audits = AuditEvent::query()->count();

    Billing::restrict($shop->organization);
    $this->get(route('shops.show', 'shine'))->assertOk();
    $this->artisan('subscriptions:send-reminders')->assertSuccessful();
    $this->artisan('organizations:mark-deletion-eligible')->assertSuccessful();

    expect($booking->fresh()->getAttributes())->toEqual($before)
        ->and($shop->organization->fresh()->published_at->equalTo($published))->toBeTrue()
        ->and(Membership::query()->where('user_id', $staff->id)->value('is_active'))->toBeTrue()
        ->and(OrganizationClosure::query()->count())->toBe(0)
        ->and(AuditEvent::query()->count())->toBe($audits);
});

test('configuration writes are refused by the common action boundary while restricted, reads stay open', function () {
    $shop = Shop::make();
    $weeklyBefore = BranchWeeklyHour::query()->count();
    Billing::restrict($shop->organization);
    $this->actingAs($shop->owner);

    $this->put(route('owner.settings.hours.update', $shop->organization), ['weekly' => [['weekday' => 1, 'opens_at' => '08:00', 'closes_at' => '12:00']], 'overrides' => []])->assertSessionHasErrors('access');
    $this->post(route('owner.settings.vehicle-types.store', $shop->organization), ['name' => 'Truck'])->assertSessionHasErrors('access');
    $this->patch(route('owner.settings.profile.update', $shop->organization), ['name' => 'Renamed', 'tagline' => 'x', 'description' => 'y', 'brand_color' => '#112233', 'branch_name' => 'Main branch', 'address_line' => '1 Rizal Ave', 'city' => 'Manila'])->assertSessionHasErrors('access');
    $this->post(route('owner.settings.unpublish', $shop->organization))->assertSessionHasErrors('access');
    $this->put(route('owner.settings.directory.update', $shop->organization), ['directory_opted_in' => true])->assertSessionHasErrors('access');
    $this->put(route('owner.settings.booking-policy.update', $shop->organization), ['approval_mode' => 'staff_approval', 'slot_interval_minutes' => 15, 'min_notice_minutes' => 60, 'horizon_days' => 30, 'approval_window_minutes' => 120])->assertSessionHasErrors('access');

    expect(BranchWeeklyHour::query()->count())->toBe($weeklyBefore)->and($shop->organization->fresh()->name)->toBe('Shine')
        ->and($shop->organization->fresh()->published_at)->not->toBeNull();
    $this->withoutVite()->get(route('owner.settings.hours', $shop->organization))->assertOk();
    $this->get(route('owner.settings.readiness', $shop->organization))->assertOk();
});

test('a resource block, a day-of operational control, still works while restricted', function () {
    $shop = Shop::make();
    Billing::restrict($shop->organization);

    $this->actingAs($shop->member(Membership::STAFF))->post(route('owner.operations.blocks.store', $shop->organization), [
        'resource_id' => $shop->records->resource->id, 'reason' => 'Drain blocked',
        'starts_at' => now()->addDay()->toIso8601String(), 'ends_at' => now()->addDay()->addHour()->toIso8601String(),
    ])->assertSessionHasNoErrors();
});

test('the directory lists only shops that can take new bookings, without clearing publication', function () {
    $open = Shop::make('open-shop');
    $restricted = Shop::make('restricted-shop');
    foreach ([$open, $restricted] as $shop) {
        $shop->organization->forceFill(['directory_opted_in' => true])->save();
    }
    Billing::restrict($restricted->organization);
    $customer = Tenant::user('customer@example.test');

    $this->actingAs($customer)->withoutVite()->get(route('customer.directory'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('shops', 1)->where('shops.0.name', 'Open-shop'));

    expect($restricted->organization->fresh()->published_at)->not->toBeNull();
});

test('a valid paid event restores new-work capability without republishing', function () {
    $shop = Shop::make();
    $graceEnds = now()->subMinute();
    Billing::restrict($shop->organization, $graceEnds);
    $published = $shop->organization->fresh()->published_at;
    Journey::placeHold($shop)->assertNotFound();

    renewAndPay($shop);

    Journey::placeHold($shop)->assertSessionHasNoErrors();
    expect(Subscription::query()->where('organization_id', $shop->organization->id)->sole()->grace_ends_at > now())->toBeTrue()
        ->and($shop->organization->fresh()->published_at->equalTo($published))->toBeTrue();
});

test('restricting one organization never affects another', function () {
    $restricted = Shop::make('restricted-shop');
    $healthy = Shop::make('healthy-shop');
    Billing::restrict($restricted->organization);

    $this->get(route('bookings.wizard', 'restricted-shop'))->assertNotFound();
    $this->get(route('bookings.wizard', 'healthy-shop'))->assertOk();
    staffWalkIn($healthy)->assertSessionHasNoErrors();
    expect(Booking::query()->where('organization_id', $healthy->organization->id)->count())->toBe(1);
});

test('restricted entitlement is time derived: no stored status or flag exists to toggle', function () {
    expect(Schema::hasColumns('subscriptions', ['status', 'is_restricted', 'restricted_at']))->toBeFalse();
});

test('time crossing the boundary needs no job to take effect', function () {
    $shop = Shop::make();
    $graceEnds = now()->addHour();
    Billing::set($shop->organization, now()->subDays(30), now()->subDays(5), $graceEnds);

    $this->get(route('bookings.wizard', 'shine'))->assertOk();
    $this->travelTo(CarbonImmutable::instance($graceEnds));
    $this->get(route('bookings.wizard', 'shine'))->assertNotFound();
});
