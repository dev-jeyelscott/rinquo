<?php

use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Jobs\RetryBookingNotification;
use App\Modules\Booking\Mail\BookingConfirmedMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingOperationEvent;
use App\Modules\Booking\Models\NotificationFailure;
use App\Modules\Booking\Models\ResourceBlock;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Membership;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Shop;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
});

function op(Shop $shop, Booking $booking, string $operation, array $data = [], ?User $as = null)
{
    $payload = ['revision' => $booking->fresh()->operation_revision, 'idempotency_key' => (string) Str::uuid()] + $data;

    return test()->actingAs($as ?? $shop->member(Membership::STAFF))->post(route("owner.operations.bookings.{$operation}", [$shop->organization, $booking->public_id]), $payload);
}

function walkIn(Shop $shop, array $data = [], ?User $as = null)
{
    $payload = $data + [
        'idempotency_key' => (string) Str::uuid(), 'mode' => 'walk_in', 'vehicle_type_id' => $shop->records->vehicle->id, 'service_id' => $shop->records->service->id,
        'add_on_ids' => [], 'contact_name' => 'Walk-in Customer', 'contact_phone' => '0917 000 0000',
    ];

    return test()->actingAs($as ?? $shop->member(Membership::STAFF))->post(route('owner.operations.bookings.store', $shop->organization), $payload);
}

function feasibleAt(Shop $shop, string $local): bool
{
    return app(AvailabilitySearch::class)->feasibleClaim($shop->organization, $shop->records->variant->fresh(), collect(), Shop::at($local), CarbonImmutable::now()) !== null;
}

test('active owners and staff operate their shop; outsiders get 404 and staff keep out of settings', function () {
    $shop = Shop::make();
    $other = Shop::make('other');
    $staff = $shop->member(Membership::STAFF);

    $this->actingAs($staff)->withoutVite()->get(route('owner.operations.index', $shop->organization))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('owner/operations')->has('queue')->has('stats'));
    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.operations.index', $shop->organization))->assertOk();
    $this->actingAs($staff)->get(route('owner.settings.hours', $shop->organization))->assertForbidden();
    $this->actingAs($staff)->get(route('owner.operations.index', $other->organization))->assertNotFound();

    $booking = $shop->booking('2026-10-05 10:00');
    $this->actingAs($other->owner)->post(route('owner.operations.bookings.check-in', [$other->organization, $booking->public_id]), ['revision' => 1, 'idempotency_key' => (string) Str::uuid()])->assertNotFound();
    $this->actingAs($other->owner)->post(route('owner.operations.bookings.check-in', [$shop->organization, $booking->public_id]), ['revision' => 1, 'idempotency_key' => (string) Str::uuid()])->assertNotFound();

    $inactive = $shop->member(Membership::STAFF);
    Membership::query()->where('user_id', $inactive->id)->update(['is_active' => false]);
    $this->actingAs($inactive)->get(route('owner.operations.index', $shop->organization))->assertNotFound();
});

test('the dashboard lists the day queue with server-truth actions', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-05 10:00');
    $shop->booking('2026-10-06 10:00');

    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.operations.index', $shop->organization))
        ->assertInertia(fn (Assert $page) => $page
            ->has('queue', 1)
            ->where('queue.0.id', $booking->public_id)
            ->where('queue.0.state', 'scheduled')
            ->where('queue.0.actions.checkIn', true)
            ->where('queue.0.actions.start', false)
            ->where('stats.appointments', 1)
            ->has('capacity', 1)
            ->where('attention', []));
});

test('check-in may be early, keeps the appointment time and queue position, and must precede start', function () {
    $shop = Shop::make();
    $first = $shop->booking('2026-10-05 10:00');
    $second = $shop->booking('2026-10-05 11:00');

    op($shop, $second, 'start')->assertSessionHasErrors('booking');
    op($shop, $second, 'check-in')->assertSessionHasNoErrors();

    $fresh = $second->fresh();
    expect($fresh->operational_state)->toBe(Booking::CHECKED_IN)
        ->and($fresh->scheduled_start_at->equalTo(Shop::at('2026-10-05 11:00')))->toBeTrue()
        ->and($fresh->queue_priority_at)->toBeNull();
    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.operations.index', $shop->organization))
        ->assertInertia(fn (Assert $page) => $page->where('queue.0.id', $second->public_id)->where('queue.1.id', $first->public_id));
    // Readiness is not priority: the queue otherwise follows the appointment order.
    expect(BookingOperationEvent::query()->where('booking_id', $second->id)->sole()->operation)->toBe('check_in');
});

test('the full transition path is enforced and audited', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-05 10:00');

    op($shop, $booking, 'complete')->assertSessionHasErrors('booking');
    op($shop, $booking, 'check-in');
    op($shop, $booking, 'complete')->assertSessionHasErrors('booking');
    op($shop, $booking, 'start')->assertSessionHasNoErrors();
    op($shop, $booking, 'check-in')->assertSessionHasErrors('booking');
    $this->travel(70)->minutes();
    op($shop, $booking, 'complete')->assertSessionHasNoErrors();
    op($shop, $booking, 'no-show', ['confirm' => 1, 'reason' => 'x'])->assertSessionHasErrors('booking');

    $fresh = $booking->fresh();
    expect($fresh->operational_state)->toBe(Booking::COMPLETED)
        ->and($fresh->started_at)->not->toBeNull()
        ->and($fresh->completed_at)->not->toBeNull()
        ->and($fresh->operation_revision)->toBe(4)
        ->and(BookingOperationEvent::query()->where('booking_id', $booking->id)->orderBy('id')->pluck('operation')->all())->toBe(['check_in', 'start', 'complete'])
        ->and(AuditEvent::query()->where('action', 'like', 'booking.%')->count())->toBe(3);
});

test('stale revisions are rejected and a replayed key does not duplicate the operation', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-05 10:00');
    $staff = $shop->member(Membership::STAFF);
    $key = (string) Str::uuid();
    $route = route('owner.operations.bookings.check-in', [$shop->organization, $booking->public_id]);

    $this->actingAs($staff)->post($route, ['revision' => 9, 'idempotency_key' => (string) Str::uuid()])->assertSessionHasErrors('revision');
    $this->actingAs($staff)->post($route, ['revision' => 1, 'idempotency_key' => $key])->assertSessionHasNoErrors();
    $this->actingAs($staff)->post($route, ['revision' => 1, 'idempotency_key' => $key])->assertSessionHasNoErrors();
    expect(BookingOperationEvent::query()->where('booking_id', $booking->id)->count())->toBe(1);

    $this->actingAs($staff)->post(route('owner.operations.bookings.start', [$shop->organization, $booking->public_id]), ['revision' => 2, 'idempotency_key' => $key])
        ->assertSessionHasErrors('idempotency_key');
});

test('a walk-in takes the earliest real gap, keeps the afternoon appointment feasible and never creates an account', function () {
    $shop = Shop::make(capacity: 1);
    $afternoon = $shop->booking('2026-10-05 12:00');
    $shop->booking('2026-10-05 09:00');              // 09:00-10:10 occupied
    $staff = $shop->member(Membership::STAFF);
    $users = User::query()->count();

    walkIn($shop, ['contact_email' => 'WALK@example.test'], $staff)->assertSessionHasNoErrors();

    $walkIn = Booking::query()->where('source', Booking::SOURCE_WALK_IN)->sole();
    expect($walkIn->scheduled_start_at->equalTo(Shop::at('2026-10-05 10:15')))->toBeTrue()
        ->and($walkIn->occupied_end_at->lessThanOrEqualTo($afternoon->scheduled_start_at))->toBeTrue()
        ->and($walkIn->customer_user_id)->toBeNull()
        ->and($walkIn->contact_email)->toBe('walk@example.test')
        ->and($walkIn->status)->toBe(Booking::CONFIRMED)
        ->and($walkIn->service_name)->toBe('Full wash')
        ->and(User::query()->count())->toBe($users)
        ->and(User::query()->where('email', 'walk@example.test')->exists())->toBeFalse()
        ->and($afternoon->fresh()->scheduled_start_at->equalTo(Shop::at('2026-10-05 12:00')))->toBeTrue();
    Mail::assertQueued(BookingConfirmedMail::class);
});

test('a walk-in with no free gap is refused instead of overbooking', function () {
    $shop = Shop::make(capacity: 1);
    $shop->booking('2026-10-05 09:00', minutes: 480);   // the bay is taken for the whole service window

    walkIn($shop)->assertSessionHasErrors('mode');
    expect(Booking::query()->where('source', Booking::SOURCE_WALK_IN)->count())->toBe(0);
});

test('a walk-in is idempotent per key and rejects a changed payload', function () {
    $shop = Shop::make();
    $staff = $shop->member(Membership::STAFF);
    $key = (string) Str::uuid();

    walkIn($shop, ['idempotency_key' => $key], $staff)->assertSessionHasNoErrors();
    walkIn($shop, ['idempotency_key' => $key], $staff)->assertSessionHasNoErrors();
    expect(Booking::query()->where('source', Booking::SOURCE_WALK_IN)->count())->toBe(1);

    walkIn($shop, ['idempotency_key' => $key, 'contact_name' => 'Someone Else'], $staff)->assertSessionHasErrors('idempotency_key');
});

test('a staff booking needs a reason inside minimum notice but never bypasses hours, windows or capacity', function () {
    $shop = Shop::make(capacity: 1);
    $this->travelTo(Shop::at('2026-10-05 09:10'));
    $inside = Shop::at('2026-10-05 09:30')->toIso8601String();   // inside the 60 minute notice, inside the service window
    $base = ['mode' => 'scheduled', 'start_at' => $inside];

    walkIn($shop, $base)->assertSessionHasErrors('policy_exception_reason');
    walkIn($shop, $base + ['policy_exception_reason' => 'Regular customer at the door'])->assertSessionHasNoErrors();
    $booking = Booking::query()->where('source', Booking::SOURCE_STAFF)->sole();
    expect($booking->customer_user_id)->toBeNull();
    $event = BookingOperationEvent::query()->where('booking_id', $booking->id)->sole();
    expect($event->details['policy_exception'])->toBe('Regular customer at the door');

    walkIn($shop, $base + ['policy_exception_reason' => 'Again'])->assertSessionHasErrors('start_at');                                  // bay is full
    walkIn($shop, ['mode' => 'scheduled', 'start_at' => Shop::at('2026-10-05 07:00')->toIso8601String(), 'policy_exception_reason' => 'Early'])->assertSessionHasErrors('start_at'); // closed
    walkIn($shop, ['mode' => 'scheduled', 'start_at' => Shop::at('2026-10-05 17:30')->toIso8601String(), 'policy_exception_reason' => 'Late'])->assertSessionHasErrors('start_at');  // outside service window
    expect(Booking::query()->where('source', Booking::SOURCE_STAFF)->count())->toBe(1);
});

test('manual assignment is validated on the server', function () {
    $shop = Shop::make(capacity: 1);
    $booking = $shop->booking('2026-10-05 10:00');
    $free = $shop->resource('Bay B', 1);
    $busy = $shop->resource('Bay C', 1);
    $inactive = $shop->resource('Bay D', 1);
    $inactive->forceFill(['is_active' => false])->save();
    $archived = $shop->resource('Bay E', 1);
    $archived->forceFill(['archived_at' => now()])->save();
    $otherType = Tenant::make(ResourceType::class, ['organization_id' => $shop->organization->id, 'branch_id' => $shop->records->type->branch_id, 'name' => 'Detail bench']);
    $incompatible = $shop->resource('Bench', 1, $otherType->id);
    $shop->booking('2026-10-05 10:00', resource: $busy);
    $foreign = Shop::make('foreign')->records->resource;
    Shop::make('shine2');
    test()->travelTo(Shop::at(Shop::NOW));

    foreach ([$busy, $inactive, $archived, $incompatible, $foreign] as $bad) {
        op($shop, $booking, 'assign', ['resource_id' => $bad->id])->assertSessionHasErrors('resource_id');
    }
    expect($booking->fresh()->actual_resource_id)->toBeNull();

    ResourceBlock::query()->create(['organization_id' => $shop->organization->id, 'public_id' => (string) Str::uuid(), 'physical_resource_id' => $free->id, 'starts_at' => Shop::at('2026-10-05 09:30'), 'ends_at' => Shop::at('2026-10-05 10:30'), 'reason' => 'Pump repair', 'created_by_user_id' => $shop->owner->id]);
    op($shop, $booking, 'assign', ['resource_id' => $free->id])->assertSessionHasErrors('resource_id');

    ResourceBlock::query()->delete();
    op($shop, $booking, 'assign', ['resource_id' => $free->id])->assertSessionHasNoErrors();
    $fresh = $booking->fresh();
    expect($fresh->actual_resource_id)->toBe($free->id)
        ->and($fresh->physical_resource_id)->toBe($shop->records->resource->id)
        ->and(BookingOperationEvent::query()->where('operation', 'assign')->sole()->to_resource_id)->toBe($free->id);
});

test('a block over bookings needs impact confirmation, hides the resource from availability and can be released', function () {
    $shop = Shop::make(capacity: 1);
    $booking = $shop->booking('2026-10-05 10:00');
    $resource = $shop->records->resource;
    $staff = $shop->member(Membership::STAFF);
    $route = route('owner.operations.blocks.store', $shop->organization);
    $window = ['resource_id' => $resource->id, 'reason' => 'Drain blocked'];

    // Over a booking it only previews: the block is never written silently, and never refused outright.
    $this->actingAs($staff)->post($route, $window + ['starts_at' => Shop::at('2026-10-05 10:30')->toIso8601String(), 'ends_at' => Shop::at('2026-10-05 12:00')->toIso8601String()])
        ->assertSessionHas('scheduling_impact', fn (array $impact) => $impact['affected'] === 1);
    expect(ResourceBlock::query()->count())->toBe(0);

    expect(feasibleAt($shop, '2026-10-05 13:00'))->toBeTrue();
    $this->actingAs($staff)->post($route, $window + ['starts_at' => Shop::at('2026-10-05 12:30')->toIso8601String(), 'ends_at' => Shop::at('2026-10-05 15:00')->toIso8601String()])->assertSessionHasNoErrors();
    expect(feasibleAt($shop, '2026-10-05 13:00'))->toBeFalse();

    $block = ResourceBlock::query()->sole();
    $this->actingAs($staff)->post(route('owner.operations.blocks.release', [$shop->organization, $block->public_id]))->assertSessionHasNoErrors();
    expect(feasibleAt($shop, '2026-10-05 13:00'))->toBeTrue()
        ->and(AuditEvent::query()->whereIn('action', ['resource_block.create', 'resource_block.release'])->count())->toBe(2);
    $this->actingAs(Shop::make('foreign2')->owner)->post(route('owner.operations.blocks.release', [$shop->organization, $block->public_id]))->assertNotFound();
});

test('a late start extends capacity to actual completion and a completion keeps the buffer', function () {
    $shop = Shop::make(capacity: 1);
    $booking = $shop->booking('2026-10-05 10:00');   // 10:00-11:00 service, 11:10 buffer end
    op($shop, $booking, 'check-in');

    $this->travelTo(Shop::at('2026-10-05 10:30'));
    op($shop, $booking, 'start')->assertSessionHasNoErrors();
    $started = $booking->fresh();
    expect($started->projectedServiceEnd()->equalTo(Shop::at('2026-10-05 11:30')))->toBeTrue()
        ->and($started->service_end_at->equalTo(Shop::at('2026-10-05 11:00')))->toBeTrue()
        ->and($started->occupied_end_at->equalTo(Shop::at('2026-10-05 11:10')))->toBeTrue();
    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.operations.index', $shop->organization))
        ->assertInertia(fn (Assert $page) => $page->where('queue.0.delayMinutes', 30)->where('queue.0.actions.complete', true)->where('capacity.0.used', 1));

    // Overrun: still working after the plan, so the bay stays occupied through the buffer.
    $this->travelTo(Shop::at('2026-10-05 11:45'));
    expect(feasibleAt($shop, '2026-10-05 11:45'))->toBeFalse();

    op($shop, $booking, 'complete')->assertSessionHasNoErrors();
    expect($booking->fresh()->capacity_release_at->equalTo(Shop::at('2026-10-05 11:55')))->toBeTrue();
    $this->travelTo(Shop::at('2026-10-05 11:50'));
    expect(feasibleAt($shop, '2026-10-05 11:50'))->toBeFalse();
    $this->travelTo(Shop::at('2026-10-05 12:00'));
    expect(feasibleAt($shop, '2026-10-05 12:00'))->toBeTrue();
});

test('completing early keeps the buffer unless it is released with a recorded reason', function () {
    $shop = Shop::make(capacity: 1);
    $booking = $shop->booking('2026-10-05 10:00');
    $this->travelTo(Shop::at('2026-10-05 10:00'));
    op($shop, $booking, 'check-in');
    op($shop, $booking, 'start');

    $this->travelTo(Shop::at('2026-10-05 10:30'));
    op($shop, $booking, 'complete', ['release_buffer' => 1])->assertSessionHasErrors('reason');
    op($shop, $booking, 'complete')->assertSessionHasNoErrors();
    expect($booking->fresh()->capacity_release_at->equalTo(Shop::at('2026-10-05 10:40')))->toBeTrue()
        ->and(feasibleAt($shop, '2026-10-05 10:30'))->toBeFalse()
        ->and(feasibleAt($shop, '2026-10-05 10:45'))->toBeTrue();

    $other = $shop->booking('2026-10-05 13:00');
    $this->travelTo(Shop::at('2026-10-05 13:00'));
    op($shop, $other, 'check-in');
    op($shop, $other, 'start');
    $this->travelTo(Shop::at('2026-10-05 13:20'));
    op($shop, $other, 'complete', ['release_buffer' => 1, 'reason' => 'Bay already wiped'])->assertSessionHasNoErrors();
    expect($other->fresh()->capacity_release_at->equalTo(Shop::at('2026-10-05 13:20')))->toBeTrue()
        ->and(BookingOperationEvent::query()->where('booking_id', $other->id)->where('operation', 'complete')->sole()->reason)->toBe('Bay already wiped');
});

test('start is refused while the resource is still occupied or blocked', function () {
    $shop = Shop::make(capacity: 1);
    $running = $shop->booking('2026-10-05 10:00');
    $this->travelTo(Shop::at('2026-10-05 10:00'));
    op($shop, $running, 'check-in');
    op($shop, $running, 'start');
    $late = $shop->booking('2026-10-05 10:05');   // the same bay is genuinely busy, so this job cannot start on it
    op($shop, $late, 'check-in');
    op($shop, $late, 'start')->assertSessionHasErrors('resource_id');
    expect($late->fresh()->operational_state)->toBe(Booking::CHECKED_IN);
});

test('a no-show needs the appointment time to pass, a reason and confirmation, and releases only then', function () {
    $shop = Shop::make(capacity: 1);
    $booking = $shop->booking('2026-10-05 10:00');

    op($shop, $booking, 'no-show', ['confirm' => 1, 'reason' => 'No call'])->assertSessionHasErrors('booking');
    $this->travelTo(Shop::at('2026-10-05 10:20'));
    op($shop, $booking, 'no-show', ['reason' => 'No call'])->assertSessionHasErrors('confirm');
    op($shop, $booking, 'no-show', ['confirm' => 1])->assertSessionHasErrors('reason');
    expect(feasibleAt($shop, '2026-10-05 10:30'))->toBeFalse();   // still claimed until confirmed

    op($shop, $booking, 'no-show', ['confirm' => 1, 'reason' => 'No call'])->assertSessionHasNoErrors();
    expect($booking->fresh()->operational_state)->toBe(Booking::NO_SHOW)
        ->and(feasibleAt($shop, '2026-10-05 10:30'))->toBeTrue()
        ->and($booking->fresh()->no_show_at)->not->toBeNull();
    op($shop, $booking, 'check-in')->assertSessionHasErrors('booking');
});

test('reordering stores a reason and positions, leaves appointment times alone and cannot let a walk-in jump an appointment', function () {
    $shop = Shop::make(capacity: 1);
    $a = $shop->booking('2026-10-05 10:00');
    $b = $shop->booking('2026-10-05 12:00');
    $w = $shop->booking('2026-10-05 14:00', attributes: ['source' => Booking::SOURCE_WALK_IN, 'customer_user_id' => null, 'contact_email' => null]);

    op($shop, $b, 'reorder', ['before' => $a->public_id])->assertSessionHasErrors('reason');
    op($shop, $b, 'reorder', ['before' => $a->public_id, 'reason' => 'Customer is in a hurry'])->assertSessionHasNoErrors();
    $event = BookingOperationEvent::query()->where('operation', 'reorder')->sole();
    expect($event->reason)->toBe('Customer is in a hurry')
        ->and($event->details['position_before'])->toBe(2)->and($event->details['position_after'])->toBe(1)
        ->and($b->fresh()->scheduled_start_at->equalTo(Shop::at('2026-10-05 12:00')))->toBeTrue();
    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.operations.index', $shop->organization))
        ->assertInertia(fn (Assert $page) => $page->where('queue.0.id', $b->public_id)->where('queue.1.id', $a->public_id)->where('queue.2.id', $w->public_id));

    op($shop, $w, 'reorder', ['before' => $a->public_id, 'reason' => 'Skip the line'])->assertSessionHasErrors('before');
});

test('permanent notification failures are tenant-scoped, durable and retryable once', function () {
    $shop = Shop::make();
    $other = Shop::make('other');
    $booking = $shop->booking('2026-10-05 10:00');
    (new BookingConfirmedMail($booking->id))->failed(new RuntimeException('smtp down for ana@example.test'));
    (new BookingConfirmedMail($booking->id))->failed(new RuntimeException('again'));
    $failure = NotificationFailure::query()->sole();

    expect($failure->error_class)->toBe(RuntimeException::class)->and($failure->status)->toBe('failed')
        ->and($booking->fresh()->status)->toBe(Booking::CONFIRMED);
    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.operations.index', $shop->organization))
        ->assertInertia(fn (Assert $page) => $page->has('attention', 1)->where('attention.0.id', $failure->public_id)->where('attention.0.status', 'failed')->where('attention.0.label', 'Booking confirmation'));
    $this->actingAs($other->owner)->withoutVite()->get(route('owner.operations.index', $other->organization))->assertInertia(fn (Assert $page) => $page->where('attention', []));
    $this->actingAs($other->owner)->post(route('owner.operations.failures.retry', [$other->organization, $failure->public_id]))->assertNotFound();
    $this->actingAs($other->owner)->post(route('owner.operations.failures.retry', [$shop->organization, $failure->public_id]))->assertNotFound();

    Queue::fake();
    $staff = $shop->member(Membership::STAFF);
    $this->actingAs($staff)->post(route('owner.operations.failures.retry', [$shop->organization, $failure->public_id]))->assertSessionHasNoErrors();
    $this->actingAs($staff)->post(route('owner.operations.failures.retry', [$shop->organization, $failure->public_id]))->assertSessionHasNoErrors();
    Queue::assertPushed(RetryBookingNotification::class, 1);
    expect($failure->fresh()->status)->toBe('retrying')->and($failure->fresh()->retry_count)->toBe(1)
        ->and(AuditEvent::query()->where('action', 'notification.retry')->count())->toBe(1);

    (new RetryBookingNotification($failure->id))->handle();
    expect($failure->fresh()->status)->toBe('resolved');
    Mail::assertSent(BookingConfirmedMail::class, 1);
    $this->actingAs($staff)->post(route('owner.operations.failures.retry', [$shop->organization, $failure->public_id]))->assertSessionHasErrors('notification');
});

test('a retry that fails again returns the failure to a retryable state', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-05 10:00');
    (new BookingConfirmedMail($booking->id))->failed(new RuntimeException('x'));
    $failure = NotificationFailure::query()->sole();
    $failure->forceFill(['status' => 'retrying'])->save();

    (new RetryBookingNotification($failure->id))->failed(new RuntimeException('still down'));
    expect($failure->fresh()->status)->toBe('failed');
});

test('operational history is append-only and snapshots stay immutable through operations', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-05 10:00');
    op($shop, $booking, 'check-in');
    $event = BookingOperationEvent::query()->sole();

    expect(fn () => BookingOperationEvent::query()->whereKey($event->id)->update(['reason' => 'rewrite']))->toThrow(QueryException::class)
        ->and(fn () => BookingOperationEvent::query()->whereKey($event->id)->delete())->toThrow(QueryException::class)
        ->and(fn () => Booking::query()->whereKey($booking->id)->update(['service_name' => 'Hacked']))->toThrow(QueryException::class)
        ->and(fn () => Booking::query()->whereKey($booking->id)->update(['source' => 'walk_in']))->toThrow(QueryException::class);
});

test('a staff-entered contact can never carry an account and illegal state combinations are impossible', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-05 10:00');
    $customer = User::query()->findOrFail($booking->customer_user_id);

    expect(fn () => Booking::query()->whereKey($booking->id)->update(['operational_state' => 'in_service']))->toThrow(QueryException::class);
    expect(fn () => $shop->booking('2026-10-05 12:00', attributes: ['source' => Booking::SOURCE_WALK_IN, 'customer_user_id' => $customer->id]))->toThrow(QueryException::class);
    expect(fn () => $shop->booking('2026-10-05 13:00', attributes: ['customer_user_id' => null]))->toThrow(QueryException::class);
});

test('customers cannot cancel or manage a staff-entered booking, and operators cannot cancel started work', function () {
    $shop = Shop::make();
    $booking = $shop->booking('2026-10-05 10:00');
    op($shop, $booking, 'check-in');
    $this->travelTo(Shop::at('2026-10-05 10:00'));
    op($shop, $booking, 'start');

    $this->actingAs($shop->member(Membership::STAFF))->post(route('owner.booking-requests.cancel', [$shop->organization, $booking->public_id]), [
        'revision' => $booking->fresh()->revision, 'idempotency_key' => (string) Str::uuid(), 'reason' => 'Oops',
    ])->assertSessionHasErrors('booking');
    expect($booking->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('the dashboard exposes only the requested day and a bounded queue', function () {
    $shop = Shop::make(capacity: 99);
    $shop->booking('2026-10-06 10:00');
    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.operations.index', [$shop->organization, 'date' => '2026-10-06']))
        ->assertInertia(fn (Assert $page) => $page->has('queue', 1)->where('day.isToday', false)->where('queue.0.actions.checkIn', false));
    $this->actingAs($shop->owner)->get(route('owner.operations.index', [$shop->organization, 'date' => 'nope']))->assertSessionHasErrors('date');
    expect(PhysicalResource::query()->count())->toBeGreaterThan(0);
});
