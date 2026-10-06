<?php

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use App\Modules\Identity\Models\User;
use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\OrganizationClosure;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Billing;
use Tests\Support\Journey;
use Tests\Support\Shop;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
    $this->gateway = Billing::fake();
});

function closeIt(Shop $shop, ?string $confirmation = 'Shine', $as = null)
{
    return test()->actingAs($as ?? $shop->owner)->post(route('owner.settings.closure.store', $shop->organization), ['confirmation' => $confirmation]);
}

function recoverIt(Shop $shop, $as = null)
{
    return test()->actingAs($as ?? $shop->owner)->post(route('owner.settings.closure.recover', $shop->organization));
}

function snapshot(Shop $shop): array
{
    $subscription = Subscription::query()->where('organization_id', $shop->organization->id)->sole();

    return [
        'subscription' => $subscription->only(['trial_ends_at', 'paid_until', 'grace_ends_at']),
        'memberships' => Membership::query()->where('organization_id', $shop->organization->id)->count(),
        'published' => $shop->organization->fresh()->published_at,
    ];
}

test('only an Owner who types the organization name can close it; the deadline is exactly 90 days', function () {
    $shop = Shop::make();
    $staff = $shop->member(Membership::STAFF);
    [$stranger] = Tenant::organization('rival');

    closeIt($shop, 'Shine', $staff)->assertForbidden();
    closeIt($shop, 'Shine', $stranger)->assertNotFound();
    closeIt($shop, 'wrong name')->assertSessionHasErrors('confirmation');
    closeIt($shop, '')->assertSessionHasErrors('confirmation');
    expect(OrganizationClosure::query()->count())->toBe(0);

    closeIt($shop)->assertSessionHasNoErrors()->assertRedirect(route('owner.settings.billing', $shop->organization));

    $closure = OrganizationClosure::query()->sole();
    expect($closure->requested_by_user_id)->toBe($shop->owner->id)
        ->and($closure->recoverable_until->equalTo($closure->requested_at->addDays(90)))->toBeTrue()
        ->and($closure->deletion_eligible_at)->toBeNull()
        ->and(AuditEvent::query()->where('action', 'organization.closure_requested')->where('actor_user_id', $shop->owner->id)->count())->toBe(1);
});

test('client-supplied deadlines and statuses are ignored', function () {
    $shop = Shop::make();

    test()->actingAs($shop->owner)->post(route('owner.settings.closure.store', $shop->organization), [
        'confirmation' => 'Shine', 'recoverable_until' => '2026-10-06', 'deletion_eligible_at' => '2026-10-06', 'requested_at' => '2020-01-01',
    ])->assertSessionHasNoErrors();

    $closure = OrganizationClosure::query()->sole();
    expect($closure->recoverable_until->equalTo($closure->requested_at->addDays(90)))->toBeTrue()
        ->and($closure->deletion_eligible_at)->toBeNull();
});

test('closing twice is rejected and creates no second record', function () {
    $shop = Shop::make();
    closeIt($shop)->assertSessionHasNoErrors();

    closeIt($shop)->assertSessionHasErrors('closure');

    expect(OrganizationClosure::query()->count())->toBe(1)->and(AuditEvent::query()->where('action', 'organization.closure_requested')->count())->toBe(1);
});

test('closing preserves every record and the subscription, and new work stops at once', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-07 10:00');
    $before = snapshot($shop);
    $bookingBefore = $booking->fresh()->getAttributes();

    closeIt($shop)->assertSessionHasNoErrors();

    expect(snapshot($shop))->toEqual($before)->and($booking->fresh()->getAttributes())->toEqual($bookingBefore);
    $this->get(route('shops.show', 'shine'))->assertNotFound();
    $this->get(route('bookings.wizard', 'shine'))->assertNotFound();
    Journey::placeHold($shop)->assertNotFound();
    $this->actingAs($shop->member(Membership::STAFF))->post(route('owner.operations.bookings.store', $shop->organization), [
        'idempotency_key' => (string) Str::uuid(), 'mode' => 'walk_in', 'vehicle_type_id' => $shop->records->vehicle->id, 'service_id' => $shop->records->service->id,
        'add_on_ids' => [], 'contact_name' => 'Walk-in',
    ])->assertSessionHasErrors('access');
    $this->actingAs($shop->owner)->post(route('owner.settings.vehicle-types.store', $shop->organization), ['name' => 'Truck'])->assertSessionHasErrors('access');
    expect(Hold::query()->where('status', Hold::ACTIVE)->count())->toBe(0);
});

test('existing bookings stay viewable, cancellable and operable while closed', function () {
    $shop = Shop::make();
    $toCancel = $shop->booking('2026-10-07 10:00');
    $toWork = $shop->booking('2026-10-05 09:00');
    closeIt($shop)->assertSessionHasNoErrors();

    $customer = User::query()->findOrFail($toCancel->customer_user_id);
    $this->actingAs($customer)->withoutVite()->get(route('bookings.show', ['shine', $toCancel->public_id]))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('booking.actions.canCancel', true)->where('booking.actions.canReschedule', false));
    $this->actingAs($customer)->post(route('bookings.cancel', ['shine', $toCancel->public_id]), ['revision' => $toCancel->fresh()->revision, 'idempotency_key' => (string) Str::uuid()])
        ->assertSessionHasNoErrors();
    $this->actingAs($shop->member(Membership::STAFF))->post(route('owner.operations.bookings.check-in', [$shop->organization, $toWork->public_id]), [
        'revision' => $toWork->fresh()->operation_revision, 'idempotency_key' => (string) Str::uuid(),
    ])->assertSessionHasNoErrors();

    expect($toCancel->fresh()->status)->toBe(Booking::CANCELLED)->and($toWork->fresh()->operational_state)->toBe(Booking::CHECKED_IN);
});

test('billing and recovery stay reachable while closed', function () {
    $shop = Shop::make();
    closeIt($shop);

    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.settings.billing', $shop->organization))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->where('entitlement.closed', true)->where('entitlement.closure.state', 'recoverable')->where('entitlement.acceptsNewBookings', false));
    $this->actingAs($shop->owner)->post(route('owner.settings.billing.renewal', $shop->organization))->assertSessionHasNoErrors();
});

test('recovery is Owner-only, keeps the closure as evidence and works until the exact deadline', function () {
    $shop = Shop::make();
    Billing::set($shop->organization, now()->addDay(), now()->addDays(200), now()->addDays(207));
    closeIt($shop);
    $closure = OrganizationClosure::query()->sole();

    recoverIt($shop, $shop->member(Membership::STAFF))->assertForbidden();
    $this->travelTo($closure->recoverable_until->subSecond());
    recoverIt($shop)->assertSessionHasNoErrors();

    $closure = $closure->fresh();
    expect($closure->recovered_at)->not->toBeNull()->and($closure->recovered_by_user_id)->toBe($shop->owner->id)
        ->and(OrganizationClosure::query()->count())->toBe(1)
        ->and(AuditEvent::query()->where('action', 'organization.closure_recovered')->where('actor_user_id', $shop->owner->id)->count())->toBe(1);
    $this->get(route('shops.show', 'shine'))->assertOk()->assertInertia(fn (Assert $page) => $page->where('bookingAvailable', true));
    recoverIt($shop)->assertSessionHasErrors('closure');
});

test('recovery fails at the deadline and afterwards', function () {
    $shop = Shop::make();
    closeIt($shop);
    $closure = OrganizationClosure::query()->sole();

    $this->travelTo($closure->recoverable_until);
    recoverIt($shop)->assertSessionHasErrors('closure');

    expect($closure->fresh()->recovered_at)->toBeNull();
});

test('a recovered organization can be closed again as a fresh closure with its own window', function () {
    $shop = Shop::make();
    closeIt($shop);
    recoverIt($shop);
    $this->travel(5)->days();

    closeIt($shop)->assertSessionHasNoErrors();

    expect(OrganizationClosure::query()->count())->toBe(2)
        ->and(OrganizationClosure::query()->whereNull('recovered_at')->sole()->requested_at->equalTo(now()))->toBeTrue();
});

test('deletion eligibility is stamped only at the 90 day boundary, idempotently, and deletes nothing', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-07 10:00');
    closeIt($shop);
    $closure = OrganizationClosure::query()->sole();
    $rows = fn () => [Booking::query()->count(), Membership::query()->count(), Subscription::query()->count(), AuditEvent::query()->count() - AuditEvent::query()->where('action', 'organization.deletion_eligible')->count()];
    $before = $rows();

    $this->travelTo($closure->recoverable_until->subSecond());
    $this->artisan('organizations:mark-deletion-eligible')->assertSuccessful();
    expect($closure->fresh()->deletion_eligible_at)->toBeNull();

    $this->travelTo($closure->recoverable_until);
    $this->artisan('organizations:mark-deletion-eligible')->assertSuccessful();
    $stamped = $closure->fresh()->deletion_eligible_at;
    $this->travel(1)->hours();
    $this->artisan('organizations:mark-deletion-eligible')->assertSuccessful();

    expect($stamped)->not->toBeNull()->and($closure->fresh()->deletion_eligible_at->equalTo($stamped))->toBeTrue()
        ->and(AuditEvent::query()->where('action', 'organization.deletion_eligible')->count())->toBe(1)
        ->and($rows())->toBe($before)
        ->and($booking->fresh())->not->toBeNull()
        ->and($shop->organization->fresh())->not->toBeNull();
    // Eligibility removes the Owner recovery path and says so; the organization stays closed.
    recoverIt($shop)->assertSessionHasErrors('closure');
    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.settings.billing', $shop->organization))
        ->assertInertia(fn (Assert $page) => $page->where('entitlement.closure.state', 'deletion_eligible')->where('entitlement.closed', true));
});

test('eligibility is not stamped for a closure that was recovered before the deadline', function () {
    $shop = Shop::make();
    closeIt($shop);
    $closure = OrganizationClosure::query()->sole();
    recoverIt($shop);

    $this->travelTo($closure->recoverable_until->addDay());
    $this->artisan('organizations:mark-deletion-eligible')->assertSuccessful();

    expect($closure->fresh()->deletion_eligible_at)->toBeNull();
});

test('non-renewal, restriction and billing timestamps never create or advance a closure', function () {
    $shop = Shop::make();
    Billing::restrict($shop->organization, now()->subDays(200));

    $this->travel(400)->days();
    $this->artisan('subscriptions:send-reminders')->assertSuccessful();
    $this->artisan('organizations:mark-deletion-eligible')->assertSuccessful();
    $this->get(route('shops.show', 'shine'))->assertOk();

    expect(OrganizationClosure::query()->count())->toBe(0)
        ->and(AuditEvent::query()->where('action', 'like', 'organization.closure%')->count())->toBe(0)
        ->and(AuditEvent::query()->where('action', 'organization.deletion_eligible')->count())->toBe(0);
});

test('closure grants and extends no entitlement, and recovery returns an expired subscription as restricted', function () {
    $shop = Shop::make();
    Billing::restrict($shop->organization);
    $subscription = snapshot($shop)['subscription'];

    closeIt($shop);
    expect(snapshot($shop)['subscription'])->toEqual($subscription);
    recoverIt($shop);

    expect(snapshot($shop)['subscription'])->toEqual($subscription);
    $this->get(route('shops.show', 'shine'))->assertOk()->assertInertia(fn (Assert $page) => $page->where('bookingAvailable', false));
    Journey::placeHold($shop)->assertNotFound();
});

test('a payment while closed extends entitlement but never erases the closure', function () {
    $shop = Shop::make();
    Billing::restrict($shop->organization);
    closeIt($shop);
    $closure = OrganizationClosure::query()->sole();
    $this->actingAs($shop->owner)->post(route('owner.settings.billing.renewal', $shop->organization))->assertSessionHasNoErrors();

    Billing::deliver(Billing::paidEvent(PaymentRequest::query()->sole()))->assertOk();

    expect(Subscription::query()->sole()->paid_until)->not->toBeNull()
        ->and($closure->fresh()->recovered_at)->toBeNull()
        ->and(OrganizationClosure::query()->count())->toBe(1);
    Journey::placeHold($shop)->assertNotFound();
});

test('the database allows one unrecovered closure and rejects incoherent timelines', function () {
    $shop = Shop::make();
    closeIt($shop);
    $closure = OrganizationClosure::query()->sole();
    $base = ['organization_id' => $shop->organization->id, 'requested_by_user_id' => $shop->owner->id, 'created_at' => now(), 'updated_at' => now()];

    expect(fn () => DB::transaction(fn () => DB::table('organization_closures')->insert($base + ['requested_at' => now(), 'recoverable_until' => now()->addDays(90)])))
        ->toThrow(QueryException::class);
    expect(fn () => DB::transaction(fn () => DB::table('organization_closures')->where('id', $closure->id)->update(['deletion_eligible_at' => $closure->recoverable_until->subDay()])))
        ->toThrow(QueryException::class);
    expect(fn () => DB::transaction(fn () => DB::table('organization_closures')->where('id', $closure->id)->update(['recoverable_until' => $closure->requested_at])))
        ->toThrow(QueryException::class);
    expect(fn () => DB::transaction(fn () => DB::table('organization_closures')->where('id', $closure->id)->update(['recovered_at' => now()])))
        ->toThrow(QueryException::class);
});

test('closing one organization does not touch another', function () {
    $closed = Shop::make('closed-shop');
    $other = Shop::make('other-shop');
    test()->actingAs($closed->owner)->post(route('owner.settings.closure.store', $closed->organization), ['confirmation' => 'Closed-shop'])->assertSessionHasNoErrors();

    $this->get(route('bookings.wizard', 'other-shop'))->assertOk();
    $this->actingAs($other->owner)->post(route('owner.settings.closure.recover', $closed->organization))->assertNotFound();
    expect(OrganizationClosure::query()->count())->toBe(1);
});
