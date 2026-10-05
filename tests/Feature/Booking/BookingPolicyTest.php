<?php

use App\Modules\Booking\Models\Booking;
use App\Modules\Scheduling\Models\BookingPolicy;
use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Journey;
use Tests\Support\Shop;
use Tests\Support\Tenant;

function policyPayload(array $overrides = []): array
{
    return $overrides + [
        'approval_mode' => 'staff_approval',
        'slot_interval_minutes' => 30,
        'min_notice_minutes' => 120,
        'horizon_days' => 14,
        'approval_window_minutes' => 60,
    ];
}

test('the owner reads the policy with defaults', function () {
    $shop = Shop::make();

    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.settings.booking-policy', $shop->organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('owner/settings/booking-policy')
            ->where('policy.approvalMode', 'auto_confirm')
            ->where('policy.slotIntervalMinutes', 15)
            ->where('policy.minNoticeMinutes', 60)
            ->where('policy.horizonDays', 30)
            ->where('policy.approvalWindowMinutes', 120));
});

test('the owner updates the policy, the change is audited in the same transaction and takes effect', function () {
    $shop = Shop::make();

    $this->actingAs($shop->owner)->put(route('owner.settings.booking-policy.update', $shop->organization), policyPayload())
        ->assertSessionHasNoErrors()->assertSessionHas('status', 'Booking policy saved.');

    $policy = $shop->organization->bookingPolicy()->firstOrFail();
    expect($policy->approval_mode)->toBe('staff_approval')->and($policy->slot_interval_minutes)->toBe(30)
        ->and($policy->min_notice_minutes)->toBe(120)->and($policy->horizon_days)->toBe(14)->and($policy->approval_window_minutes)->toBe(60);

    $event = AuditEvent::query()->where('action', 'booking_policy.updated')->sole();
    expect($event->actor_user_id)->toBe($shop->owner->id)
        ->and($event->before)->toEqual(['approval_mode' => 'auto_confirm', 'slot_interval_minutes' => 15, 'min_notice_minutes' => 60, 'horizon_days' => 30, 'approval_window_minutes' => 120])
        ->and($event->after)->toEqual(policyPayload());

    // New availability follows the new policy: 30 minute grid.
    auth()->logout();
    $this->withoutVite()->get(route('bookings.wizard', ['slug' => 'shine', 'vehicle' => $shop->records->vehicle->id, 'service' => $shop->records->service->id, 'date' => '2026-10-06']))
        ->assertInertia(fn (Assert $page) => $page->where('availability.times.1.startAt', Shop::at('2026-10-06 09:30')->toIso8601String()));
});

test('saving an unchanged policy writes no audit event', function () {
    $shop = Shop::make();
    $current = ['approval_mode' => 'auto_confirm', 'slot_interval_minutes' => 15, 'min_notice_minutes' => 60, 'horizon_days' => 30, 'approval_window_minutes' => 120];

    $this->actingAs($shop->owner)->put(route('owner.settings.booking-policy.update', $shop->organization), $current)->assertSessionHasNoErrors();

    expect(AuditEvent::query()->where('action', 'booking_policy.updated')->count())->toBe(0);
});

test('staff are forbidden and another tenant gets a not-found', function () {
    $shop = Shop::make();
    $rival = Shop::make('rival');

    $this->actingAs($shop->member('staff'))->put(route('owner.settings.booking-policy.update', $shop->organization), policyPayload())->assertForbidden();
    $this->actingAs($rival->owner)->get(route('owner.settings.booking-policy', $shop->organization))->assertNotFound();
    $this->actingAs($rival->owner)->put(route('owner.settings.booking-policy.update', $shop->organization), policyPayload())->assertNotFound();

    expect($shop->organization->bookingPolicy()->firstOrFail()->approval_mode)->toBe('auto_confirm');
});

test('every range and enum boundary is validated', function (array $overrides, ?string $invalid) {
    $shop = Shop::make();

    $response = $this->actingAs($shop->owner)->put(route('owner.settings.booking-policy.update', $shop->organization), policyPayload($overrides));

    $invalid === null ? $response->assertSessionHasNoErrors() : $response->assertSessionHasErrors($invalid);
})->with([
    'valid minimums' => [['min_notice_minutes' => 0, 'horizon_days' => 1, 'approval_window_minutes' => 15, 'slot_interval_minutes' => 5], null],
    'valid maximums' => [['min_notice_minutes' => 10080, 'horizon_days' => 365, 'approval_window_minutes' => 1440, 'slot_interval_minutes' => 60], null],
    'unknown approval mode' => [['approval_mode' => 'maybe'], 'approval_mode'],
    'interval not allowed' => [['slot_interval_minutes' => 25], 'slot_interval_minutes'],
    'negative notice' => [['min_notice_minutes' => -1], 'min_notice_minutes'],
    'notice above a week' => [['min_notice_minutes' => 10081], 'min_notice_minutes'],
    'horizon zero' => [['horizon_days' => 0], 'horizon_days'],
    'horizon above a year' => [['horizon_days' => 366], 'horizon_days'],
    'window below 15' => [['approval_window_minutes' => 14], 'approval_window_minutes'],
    'window above a day' => [['approval_window_minutes' => 1441], 'approval_window_minutes'],
    'non integer' => [['horizon_days' => 'soon'], 'horizon_days'],
]);

test('the database itself rejects invalid direct writes', function (string $column, mixed $value) {
    $shop = Shop::make();

    expect(fn () => DB::transaction(fn () => DB::table('booking_policies')->where('organization_id', $shop->organization->id)->update([$column => $value])))
        ->toThrow(QueryException::class);
})->with([
    ['approval_mode', 'maybe'],
    ['slot_interval_minutes', 25],
    ['min_notice_minutes', 10081],
    ['horizon_days', 0],
    ['horizon_days', 366],
    ['approval_window_minutes', 14],
    ['approval_window_minutes', 1441],
]);

test('there is exactly one policy per organization, from onboarding and from the backfill', function () {
    $owner = Tenant::user('new-owner@example.test');
    $this->actingAs($owner)->post(route('owner.onboarding.store'), ['name' => 'Fresh', 'slug' => 'fresh', 'branch_name' => 'Main'])->assertSessionHasNoErrors();

    $organization = Organization::query()->where('slug', 'fresh')->sole();
    expect(BookingPolicy::query()->where('organization_id', $organization->id)->count())->toBe(1)
        ->and($organization->bookingPolicy()->firstOrFail()->approval_mode)->toBe('auto_confirm');

    expect(fn () => DB::transaction(fn () => DB::table('booking_policies')->insert(['organization_id' => $organization->id, 'created_at' => now(), 'updated_at' => now()])))
        ->toThrow(QueryException::class);

    // The backfill statement used by the migration gives a default row to every organization without one.
    DB::table('booking_policies')->delete();
    DB::statement('INSERT INTO booking_policies (organization_id, created_at, updated_at) SELECT id, now(), now() FROM organizations');
    expect(BookingPolicy::query()->count())->toBe(Organization::query()->count());
});

test('changing the policy never changes existing booking snapshots', function () {
    $shop = Shop::make();
    $this->actingAs(Tenant::user('c@example.test'));
    $hold = Journey::hold($shop);
    Journey::saveDetails($shop, $hold);
    Journey::confirm($shop, $hold);
    $before = Booking::query()->sole()->getAttributes();
    auth()->logout();

    $this->actingAs($shop->owner)->put(route('owner.settings.booking-policy.update', $shop->organization), policyPayload())->assertSessionHasNoErrors();

    expect(Booking::query()->sole()->getAttributes())->toEqual($before)
        ->and(Booking::query()->sole()->approval_mode)->toBe('auto_confirm');
});
