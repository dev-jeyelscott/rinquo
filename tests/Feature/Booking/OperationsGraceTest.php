<?php

use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingOperationEvent;
use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Membership;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Journey;
use Tests\Support\Shop;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
    $this->withoutVite();
});

function graceOp(Shop $shop, Booking $booking, string $operation, array $data = [])
{
    $payload = ['revision' => $booking->fresh()->operation_revision, 'idempotency_key' => (string) Str::uuid()] + $data;

    return test()->actingAs($shop->member(Membership::STAFF))->post(route("owner.operations.bookings.{$operation}", [$shop->organization, $booking->public_id]), $payload);
}

function graceBooking(Shop $shop, string $local, ?int $grace, array $attributes = []): Booking
{
    $snapshot = ['slot_interval_minutes' => 15, 'min_notice_minutes' => 60, 'horizon_days' => 30, 'approval_window_minutes' => 15] + ($grace === null ? [] : ['late_arrival_grace_minutes' => $grace]);

    return $shop->booking($local, attributes: $attributes + ['policy_snapshot' => $snapshot]);
}

function graceFeasible(Shop $shop, string $local): bool
{
    return app(AvailabilitySearch::class)->feasibleClaim($shop->organization, $shop->records->variant->fresh(), collect(), Shop::at($local), CarbonImmutable::now()) !== null;
}

function boardRow(Shop $shop, Booking $booking, string $field)
{
    $row = collect(test()->actingAs($shop->owner)->get(route('owner.operations.index', $shop->organization))->viewData('page')['props']['queue'])->firstWhere('id', $booking->public_id);

    return data_get($row, $field);
}

test('no-show is unavailable before the snapshotted grace deadline and available exactly at it', function () {
    $shop = Shop::make(capacity: 1);
    $booking = graceBooking($shop, '2026-10-05 10:00', 30);

    $this->travelTo(Shop::at('2026-10-05 10:29:59'));
    expect(boardRow($shop, $booking, 'actions.noShow'))->toBeFalse()
        ->and(boardRow($shop, $booking, 'graceMinutes'))->toBe(30);
    graceOp($shop, $booking, 'no-show', ['confirm' => 1, 'reason' => 'No call'])->assertSessionHasErrors('booking');
    expect($booking->fresh()->operational_state)->toBe(Booking::SCHEDULED);

    $this->travelTo(Shop::at('2026-10-05 10:30:00'));
    expect(boardRow($shop, $booking, 'actions.noShow'))->toBeTrue()
        ->and(Carbon::parse(boardRow($shop, $booking, 'noShowEligibleAt'))->utc()->toIso8601String())->toBe(Shop::at('2026-10-05 10:30')->toIso8601String());
    graceOp($shop, $booking, 'no-show', ['confirm' => 1, 'reason' => 'No call'])->assertSessionHasNoErrors();
    expect($booking->fresh()->operational_state)->toBe(Booking::NO_SHOW);
});

test('a historical snapshot without the grace key means the locked fifteen minutes', function () {
    $shop = Shop::make(capacity: 1);
    $booking = graceBooking($shop, '2026-10-05 10:00', null);

    expect($booking->lateArrivalGraceMinutes())->toBe(15);
    $this->travelTo(Shop::at('2026-10-05 10:14'));
    graceOp($shop, $booking, 'no-show', ['confirm' => 1, 'reason' => 'x'])->assertSessionHasErrors('booking');
    $this->travelTo(Shop::at('2026-10-05 10:15'));
    graceOp($shop, $booking, 'no-show', ['confirm' => 1, 'reason' => 'x'])->assertSessionHasNoErrors();
});

test('new bookings snapshot the grace in force and a later policy change never moves their deadline', function () {
    $shop = Shop::make();
    $shop->policy(['late_arrival_grace_minutes' => 25]);
    $this->actingAs(Tenant::user('grace@example.test'));
    $hold = Journey::hold($shop);
    Journey::saveDetails($shop, $hold)->assertSessionHasNoErrors();
    Journey::confirm($shop, $hold)->assertSessionHasNoErrors();
    $booking = Booking::query()->sole();

    expect($booking->policy_snapshot['late_arrival_grace_minutes'])->toBe(25);
    $shop->policy(['late_arrival_grace_minutes' => 60]);
    expect($booking->fresh()->lateArrivalGraceMinutes())->toBe(25)
        ->and($booking->fresh()->noShowEligibleAt()->equalTo($booking->scheduled_start_at->addMinutes(25)))->toBeTrue();
});

test('on-time arrival is unchanged and keeps the planned claim', function () {
    $shop = Shop::make(capacity: 1);
    $booking = graceBooking($shop, '2026-10-05 10:00', 15);

    $this->travelTo(Shop::at('2026-10-05 10:14'));
    graceOp($shop, $booking, 'check-in')->assertSessionHasNoErrors();

    $fresh = $booking->fresh();
    expect($fresh->late_arrival_at)->toBeNull()->and($fresh->queue_priority_at)->toBeNull()
        ->and(graceFeasible($shop, '2026-10-05 10:30'))->toBeFalse();
});

test('a late arrival stays confirmed at its time, releases the missed claim and queues after waiting work', function () {
    $shop = Shop::make(capacity: 2);
    $first = graceBooking($shop, '2026-10-05 09:00', 15);
    $early = graceBooking($shop, '2026-10-05 13:00', 15);
    $late = graceBooking($shop, '2026-10-05 10:00', 15);

    $this->travelTo(Shop::at('2026-10-05 09:00'));
    graceOp($shop, $first, 'check-in');
    graceOp($shop, $early, 'check-in');   // early arrival: its queue key stays 13:00
    $this->travelTo(Shop::at('2026-10-05 10:20'));
    graceOp($shop, $late, 'check-in')->assertSessionHasNoErrors()
        ->assertSessionHas('status', fn (string $status): bool => str_contains($status, 'late arrival'));

    $fresh = $late->fresh();
    expect($fresh->status)->toBe(Booking::CONFIRMED)->and($fresh->operational_state)->toBe(Booking::CHECKED_IN)
        ->and($fresh->scheduled_start_at->equalTo(Shop::at('2026-10-05 10:00')))->toBeTrue()
        ->and($fresh->late_arrival_at->equalTo(Shop::at('2026-10-05 10:20')))->toBeTrue()
        ->and($fresh->queue_priority_at->greaterThan(Shop::at('2026-10-05 13:00')))->toBeTrue()
        ->and(BookingOperationEvent::query()->where('booking_id', $late->id)->sole()->details)->toMatchArray(['late_arrival' => true, 'late_minutes' => 20]);

    $this->actingAs($shop->owner)->get(route('owner.operations.index', $shop->organization))
        ->assertInertia(fn (Assert $page) => $page
            ->where('queue.0.id', $first->public_id)->where('queue.1.id', $early->public_id)->where('queue.2.id', $late->public_id)
            ->where('queue.2.lateArrivalAt', Shop::at('2026-10-05 10:20')->toIso8601String())
            ->where('queue.2.state', 'checked_in'));
    expect(AuditEvent::query()->where('action', 'booking.check_in')->count())->toBe(3);
});

test('releasing the missed claim frees it, but a late arrival can only start where a safe span still exists', function () {
    $shop = Shop::make(capacity: 1);
    $late = graceBooking($shop, '2026-10-05 10:00', 15);

    $this->travelTo(Shop::at('2026-10-05 10:20'));
    expect(graceFeasible($shop, '2026-10-05 10:30'))->toBeFalse();   // the planned claim holds until arrival
    graceOp($shop, $late, 'check-in')->assertSessionHasNoErrors();
    expect(graceFeasible($shop, '2026-10-05 10:30'))->toBeTrue();    // released: the slot can be sold again

    // A confirmed booking takes the freed time; the late arrival must not displace it.
    $taker = graceBooking($shop, '2026-10-05 10:30', 15);
    graceOp($shop, $late, 'start')->assertSessionHasErrors('resource_id');
    expect($late->fresh()->operational_state)->toBe(Booking::CHECKED_IN)->and($taker->fresh()->status)->toBe(Booking::CONFIRMED);

    // Once the bay is genuinely free, the same arrival starts.
    $this->travelTo(Shop::at('2026-10-05 11:45'));
    graceOp($shop, $late, 'start')->assertSessionHasNoErrors();
    expect($late->fresh()->operational_state)->toBe(Booking::IN_SERVICE);
});

test('an unarrived booking after grace stays confirmed and can still check in late rather than being forced to no-show', function () {
    $shop = Shop::make(capacity: 1);
    $booking = graceBooking($shop, '2026-10-05 10:00', 15);
    $this->travelTo(Shop::at('2026-10-05 11:00'));

    expect(boardRow($shop, $booking, 'actions.noShow'))->toBeTrue()->and(boardRow($shop, $booking, 'actions.checkIn'))->toBeTrue();
    graceOp($shop, $booking, 'check-in')->assertSessionHasNoErrors();
    graceOp($shop, $booking, 'no-show', ['confirm' => 1, 'reason' => 'x'])->assertSessionHasErrors('booking');
    expect($booking->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('grace is owner-only policy, staff are denied and another tenant cannot read it', function () {
    $shop = Shop::make();
    $rival = Shop::make('rival');
    $payload = ['approval_mode' => 'auto_confirm', 'slot_interval_minutes' => 15, 'min_notice_minutes' => 60, 'horizon_days' => 30, 'approval_window_minutes' => 120, 'late_arrival_grace_minutes' => 45];

    $this->actingAs($shop->member(Membership::STAFF))->put(route('owner.settings.booking-policy.update', $shop->organization), $payload)->assertForbidden();
    $this->actingAs($rival->owner)->put(route('owner.settings.booking-policy.update', $shop->organization), $payload)->assertNotFound();
    expect($shop->organization->bookingPolicy()->firstOrFail()->late_arrival_grace_minutes)->toBe(15);

    $this->actingAs($shop->owner)->put(route('owner.settings.booking-policy.update', $shop->organization), $payload)->assertSessionHasNoErrors();
    expect($shop->organization->bookingPolicy()->firstOrFail()->late_arrival_grace_minutes)->toBe(45)
        ->and(AuditEvent::query()->where('action', 'booking_policy.updated')->sole()->after['late_arrival_grace_minutes'])->toBe(45);
});

test('a late arrival fact is impossible without check-in', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-05 10:00');

    expect(fn () => DB::transaction(fn () => DB::table('bookings')->where('id', $booking->id)->update(['late_arrival_at' => Shop::at('2026-10-05 10:30')])))
        ->toThrow(QueryException::class);
});
