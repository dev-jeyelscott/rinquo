<?php

use App\Modules\Booking\Events\OperationsChanged;
use App\Modules\Booking\Mail\BookingConfirmedMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\NotificationFailure;
use App\Modules\Booking\Models\ResourceBlock;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Models\Membership;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Shop;

beforeEach(function () {
    Mail::fake();
    $this->withoutVite();
});

test('a day with more than one page keeps every booking reachable in a stable, state-ranked order', function () {
    $shop = Shop::make(capacity: 300);
    foreach (range(1, 204) as $i) {
        $shop->booking('2026-10-05 10:00');
    }
    $running = $shop->booking('2026-10-05 16:00', attributes: [
        'operational_state' => Booking::IN_SERVICE, 'checked_in_at' => Shop::at('2026-10-05 07:50'), 'started_at' => Shop::at('2026-10-05 07:55'), 'actual_resource_id' => $shop->records->resource->id,
    ]);
    $shop->booking('2026-10-06 10:00');
    $other = Shop::make('other', capacity: 300);
    $other->booking('2026-10-05 10:00');

    $url = route('owner.operations.index', $shop->organization);
    $seen = [];
    $this->actingAs($shop->owner)->get($url)->assertInertia(function (Assert $page) use (&$seen, $running) {
        $page->has('queue', 200)->where('queue.0.id', $running->public_id)->where('stats.appointments', 205)->where('stats.inService', 1)
            ->where('pages.queue', ['page' => 1, 'perPage' => 200, 'total' => 205, 'lastPage' => 2, 'from' => 1, 'to' => 200]);
        $seen = array_merge($seen, collect($page->toArray()['props']['queue'])->pluck('id')->all());
    });
    $this->actingAs($shop->owner)->get($url.'?queue_page=2')->assertInertia(function (Assert $page) use (&$seen) {
        $page->has('queue', 5)->where('pages.queue.page', 2)->where('pages.queue.from', 201)->where('pages.queue.to', 205);
        $seen = array_merge($seen, collect($page->toArray()['props']['queue'])->pluck('id')->all());
    });

    expect($seen)->toHaveCount(205)->and(array_unique($seen))->toHaveCount(205)
        ->and(Booking::query()->where('organization_id', $shop->organization->id)->whereDate('scheduled_start_at', '<', '2026-10-06')->pluck('public_id')->diff($seen)->all())->toBe([]);
    // A page past the end resolves to the nearest valid page instead of a blank one.
    $this->actingAs($shop->owner)->get($url.'?queue_page=9')->assertInertia(fn (Assert $page) => $page->has('queue', 5)->where('pages.queue.page', 2));
});

test('the queue query stays bounded no matter how many bookings the day has', function () {
    $shop = Shop::make(capacity: 300);
    foreach (range(1, 60) as $i) {
        $shop->booking('2026-10-05 10:00');
    }
    $count = function () use ($shop): int {
        DB::enableQueryLog();
        $this->actingAs($shop->owner)->get(route('owner.operations.index', $shop->organization))->assertOk();
        $queries = count(DB::getQueryLog());
        DB::disableQueryLog();
        DB::flushQueryLog();

        return $queries;
    };
    $few = $count();
    foreach (range(1, 60) as $i) {
        $shop->booking('2026-10-05 10:00');
    }

    expect($count())->toBe($few);
});

test('blocks and failures are paged separately and nothing actionable is hidden', function () {
    $shop = Shop::make(capacity: 300);
    foreach (range(1, 52) as $i) {
        ResourceBlock::query()->create([
            'organization_id' => $shop->organization->id, 'public_id' => (string) Str::uuid(), 'physical_resource_id' => $shop->records->resource->id,
            'starts_at' => Shop::at('2026-10-05 12:00')->addMinutes($i), 'ends_at' => Shop::at('2026-10-05 20:00'), 'reason' => "Block {$i}", 'created_by_user_id' => $shop->owner->id,
        ]);
        $booking = $shop->booking('2026-10-05 10:00');
        (new BookingConfirmedMail($booking->id))->failed(new RuntimeException('x'));
    }
    $url = route('owner.operations.index', $shop->organization);

    $this->actingAs($shop->owner)->get($url)->assertInertia(fn (Assert $page) => $page
        ->has('blocks', 50)->has('attention', 50)
        ->where('pages.blocks.total', 52)->where('pages.blocks.lastPage', 2)->where('pages.failures.total', 52)->where('pages.failures.lastPage', 2)
        ->where('pages.queue.page', 1));
    $this->actingAs($shop->owner)->get($url.'?blocks_page=2&failures_page=2')->assertInertia(fn (Assert $page) => $page
        ->has('blocks', 2)->has('attention', 2)->where('pages.blocks.page', 2)->where('pages.failures.page', 2)->where('pages.queue.page', 1));
    expect(NotificationFailure::query()->count())->toBe(52);
});

test('list state is validated: closed view and filter values and positive integer pages', function () {
    $shop = Shop::make();
    $url = route('owner.operations.index', $shop->organization);
    $this->actingAs($shop->owner);

    foreach (['view' => 'admin', 'filter' => 'everything', 'queue_page' => '0', 'blocks_page' => 'x', 'failures_page' => '-1'] as $key => $value) {
        $this->get($url.'?'.$key.'='.$value)->assertSessionHasErrors($key);
    }
    foreach (['dashboard', 'queue', 'bookings', 'walk-in', 'more'] as $view) {
        $this->get($url.'?view='.$view)->assertOk()->assertInertia(fn (Assert $page) => $page->where('view', $view));
    }
    $this->get($url)->assertInertia(fn (Assert $page) => $page->where('view', 'dashboard')->where('filter', 'all'));
});

test('the queue filter narrows the list by state and totals describe the filtered result', function () {
    $shop = Shop::make(capacity: 9);
    $shop->booking('2026-10-05 10:00');
    $shop->booking('2026-10-05 11:00', attributes: ['operational_state' => Booking::CHECKED_IN, 'checked_in_at' => Shop::at('2026-10-05 07:00')]);

    $this->actingAs($shop->owner)->get(route('owner.operations.index', [$shop->organization, 'filter' => 'checked_in']))
        ->assertInertia(fn (Assert $page) => $page->has('queue', 1)->where('queue.0.state', 'checked_in')->where('pages.queue.total', 1)->where('stats.appointments', 2));
});

test('the shared shell receives a server-derived role and Staff are denied Owner areas', function () {
    $shop = Shop::make();
    $staff = $shop->member(Membership::STAFF);
    $url = route('owner.operations.index', $shop->organization);

    $this->actingAs($staff)->get($url)->assertInertia(fn (Assert $page) => $page->where('viewer', ['role' => 'staff', 'canManageOwnerAreas' => false]));
    $this->actingAs($shop->owner)->get($url)->assertInertia(fn (Assert $page) => $page->where('viewer', ['role' => 'owner', 'canManageOwnerAreas' => true]));
    $this->actingAs($staff)->get(route('owner.settings.billing', $shop->organization))->assertForbidden();
    $this->actingAs($staff)->get(route('owner.settings.index', $shop->organization))->assertForbidden();
    // Another tenant's member never reaches this organization's board.
    $other = Shop::make('other');
    $this->actingAs($other->owner)->get($url)->assertNotFound();
});

test('operational changes nudge the organization channel after commit and carry no data', function () {
    Event::fake([OperationsChanged::class]);
    $shop = Shop::make(capacity: 1);
    $booking = $shop->booking('2026-10-05 10:00');
    $staff = $shop->member(Membership::STAFF);

    expect(is_subclass_of(OperationsChanged::class, ShouldDispatchAfterCommit::class) || in_array(ShouldDispatchAfterCommit::class, class_implements(OperationsChanged::class), true))->toBeTrue();

    $this->actingAs($staff)->post(route('owner.operations.bookings.check-in', [$shop->organization, $booking->public_id]), ['revision' => 1, 'idempotency_key' => (string) Str::uuid()])->assertSessionHasNoErrors();
    Event::assertDispatched(OperationsChanged::class, function (OperationsChanged $event) use ($shop): bool {
        return $event->organizationId === $shop->organization->id
            && $event->broadcastOn()->name === 'private-operations.'.$shop->organization->id
            && $event->broadcastWith() === [] && $event->broadcastAs() === 'operations.changed';
    });

    Event::fake([OperationsChanged::class]);
    $this->actingAs($staff)->post(route('owner.operations.blocks.store', $shop->organization), [
        'resource_id' => $shop->records->resource->id, 'reason' => 'Drain', 'starts_at' => Shop::at('2026-10-05 15:00')->toIso8601String(), 'ends_at' => Shop::at('2026-10-05 16:00')->toIso8601String(),
    ])->assertSessionHasNoErrors();
    Event::assertDispatched(OperationsChanged::class, 1);

    Event::fake([OperationsChanged::class]);
    $this->actingAs($staff)->post(route('owner.operations.blocks.release', [$shop->organization, ResourceBlock::query()->sole()->public_id]))->assertSessionHasNoErrors();
    Event::assertDispatched(OperationsChanged::class, 1);

    Event::fake([OperationsChanged::class]);
    (new BookingConfirmedMail($booking->id))->failed(new RuntimeException('down'));
    Event::assertDispatched(OperationsChanged::class, fn (OperationsChanged $event): bool => $event->organizationId === $shop->organization->id);

    // The queue is synchronous in tests: the retry request nudges, and so does its delivery outcome.
    Event::fake([OperationsChanged::class]);
    $this->actingAs($staff)->post(route('owner.operations.failures.retry', [$shop->organization, NotificationFailure::query()->sole()->public_id]))->assertSessionHasNoErrors();
    Event::assertDispatched(OperationsChanged::class, fn (OperationsChanged $event): bool => $event->organizationId === $shop->organization->id);
});

test('a staff-created booking nudges the board', function () {
    Event::fake([OperationsChanged::class]);
    $shop = Shop::make();
    $this->actingAs($shop->member(Membership::STAFF))->post(route('owner.operations.bookings.store', $shop->organization), [
        'idempotency_key' => (string) Str::uuid(), 'mode' => 'walk_in', 'vehicle_type_id' => $shop->records->vehicle->id, 'service_id' => $shop->records->service->id,
        'add_on_ids' => [], 'contact_name' => 'Walk-in', 'contact_phone' => '0917 000 0000',
    ])->assertSessionHasNoErrors();

    Event::assertDispatched(OperationsChanged::class, fn (OperationsChanged $event): bool => $event->organizationId === $shop->organization->id);
});

test('only active members of the exact organization may subscribe to its operations channel', function () {
    config(['broadcasting.default' => 'reverb']);
    Broadcast::purge('reverb');
    require base_path('routes/channels.php');
    $shop = Shop::make();
    $rival = Shop::make('rival');
    $inactive = $shop->member(Membership::STAFF);
    Membership::query()->where('user_id', $inactive->id)->update(['is_active' => false]);
    $auth = fn (User $user, int $organizationId) => $this->actingAs($user)->post('/broadcasting/auth', ['socket_id' => '1234.5678', 'channel_name' => 'private-operations.'.$organizationId]);

    $auth($shop->owner, $shop->organization->id)->assertOk()->assertJsonStructure(['auth']);
    $auth($shop->member(Membership::STAFF), $shop->organization->id)->assertOk();
    $auth($inactive, $shop->organization->id)->assertForbidden();
    $auth($rival->owner, $shop->organization->id)->assertForbidden();
    $auth(User::query()->findOrFail($shop->booking('2026-10-06 10:00')->customer_user_id), $shop->organization->id)->assertForbidden();
});
