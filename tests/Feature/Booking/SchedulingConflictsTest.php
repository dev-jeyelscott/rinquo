<?php

use App\Modules\Booking\Actions\ExpireConflictProposals;
use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Mail\BookingConfirmedMail;
use App\Modules\Booking\Mail\SchedulingConflictStaffMail;
use App\Modules\Booking\Mail\SchedulingProposalMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\ConflictEvent;
use App\Modules\Booking\Models\ConflictProposal;
use App\Modules\Booking\Models\ResourceBlock;
use App\Modules\Booking\Models\SchedulingConflict;
use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\CapacityConsumption;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Membership;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Shop;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
});

/** Posts a change; when the server asks for confirmation, returns the review payload instead of committing. */
function blockResource(Shop $shop, $resource, string $from, string $to, array $extra = [], ?User $as = null)
{
    $payload = $extra + ['resource_id' => $resource->id, 'reason' => 'Drain blocked', 'starts_at' => Shop::at($from)->toIso8601String(), 'ends_at' => Shop::at($to)->toIso8601String()];

    return test()->actingAs($as ?? $shop->member(Membership::STAFF))->post(route('owner.operations.blocks.store', $shop->organization), $payload);
}

/** Blocks a resource through the full preview then confirm flow and returns the confirmed response. */
function confirmedBlock(Shop $shop, $resource, string $from, string $to)
{
    $staff = $shop->member(Membership::STAFF);
    $preview = blockResource($shop, $resource, $from, $to, as: $staff);
    $token = session('scheduling_impact.token');
    expect($token)->toBeString();

    return blockResource($shop, $resource, $from, $to, ['impact_token' => $token], $staff);
}

function conflictOf(Booking $booking): SchedulingConflict
{
    return SchedulingConflict::query()->where('booking_id', $booking->id)->latest('id')->firstOrFail();
}

function propose(Shop $shop, SchedulingConflict $conflict, string $local, array $extra = [], ?User $as = null)
{
    $payload = $extra + ['revision' => $conflict->fresh()->revision, 'idempotency_key' => (string) Str::uuid(), 'start_at' => Shop::at($local)->toIso8601String()];

    return test()->actingAs($as ?? $shop->member(Membership::STAFF))->post(route('owner.scheduling-conflicts.proposal.store', [$shop->organization, $conflict->public_id]), $payload);
}

function respond(Shop $shop, Booking $booking, string $answer, ConflictProposal $proposal, array $extra = [], ?User $as = null)
{
    $payload = $extra + ['proposal' => $proposal->public_id, 'revision' => $proposal->fresh()->revision, 'idempotency_key' => (string) Str::uuid()];

    return test()->actingAs($as ?? User::query()->findOrFail($booking->customer_user_id))->post(route("bookings.proposal.{$answer}", [$shop->organization->slug, $booking->public_id]), $payload);
}

function feasible(Shop $shop, string $local): bool
{
    return app(AvailabilitySearch::class)->feasibleClaim($shop->organization, $shop->records->variant->fresh(), collect(), Shop::at($local), CarbonImmutable::now()) !== null;
}

/** A single-bay shop whose 10:00 booking is blocked out, leaving an open conflict. */
function conflicted(?Shop &$shop = null): Booking
{
    $shop = Shop::make(capacity: 1);
    $booking = $shop->booking('2026-10-05 10:00');
    confirmedBlock($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00');

    return $booking;
}

test('a block over bookings first previews the exact impact and writes nothing', function () {
    $shop = Shop::make(capacity: 1);
    $booking = $shop->booking('2026-10-05 10:00');

    blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00')
        ->assertSessionHas('scheduling_impact', fn (array $impact) => $impact['affected'] === 1 && $impact['conflicts'] === 1 && $impact['reassigned'] === 0
            && $impact['bookings'][0]['id'] === $booking->public_id && $impact['bookings'][0]['outcome'] === 'conflict' && $impact['bookings'][0]['cause'] === 'resource_blocked');

    expect(ResourceBlock::query()->count())->toBe(0)
        ->and(SchedulingConflict::query()->count())->toBe(0)
        ->and(AuditEvent::query()->where('action', 'like', 'resource_block.%')->count())->toBe(0);
});

test('confirming a block with no same-time resource creates an explicit conflict and keeps the booking intact', function () {
    $shop = Shop::make(capacity: 1);
    $booking = $shop->booking('2026-10-05 10:00');
    $before = $booking->only(['status', 'scheduled_start_at', 'occupied_end_at', 'service_name', 'total_price_centavos', 'consumption_units', 'physical_resource_id', 'resource_type_id']);

    confirmedBlock($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00')->assertSessionHasNoErrors();

    $conflict = conflictOf($booking);
    $fresh = $booking->fresh();
    expect(ResourceBlock::query()->count())->toBe(1)
        ->and($conflict->status)->toBe(SchedulingConflict::OPEN)
        ->and($conflict->cause)->toBe('resource_blocked')
        ->and($conflict->resolution)->toBeNull()
        ->and($fresh->only(array_keys($before)))->toEqual($before)
        ->and($fresh->status)->toBe(Booking::CONFIRMED)
        ->and(ConflictEvent::query()->where('conflict_id', $conflict->id)->pluck('event')->all())->toBe(['detected'])
        ->and(AuditEvent::query()->where('action', 'scheduling_conflict.detected')->count())->toBe(1);
    // Staff are told at once; the customer is not.
    Mail::assertQueued(SchedulingConflictStaffMail::class);
    Mail::assertNotQueued(SchedulingProposalMail::class);
    Mail::assertNotQueued(BookingConfirmedMail::class);
});

test('a same-time compatible resource keeps the appointment time and is recorded without notifying the customer', function () {
    $shop = Shop::make(capacity: 1);
    $second = $shop->resource('Bay 2', 1);
    $booking = $shop->booking('2026-10-05 10:00');

    confirmedBlock($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00')->assertSessionHasNoErrors();

    $conflict = conflictOf($booking);
    $fresh = $booking->fresh();
    expect($fresh->physical_resource_id)->toBe($second->id)
        ->and($fresh->scheduled_start_at->equalTo(Shop::at('2026-10-05 10:00')))->toBeTrue()
        ->and($fresh->status)->toBe(Booking::CONFIRMED)
        ->and($conflict->status)->toBe(SchedulingConflict::RESOLVED)
        ->and($conflict->resolution)->toBe(SchedulingConflict::SAME_TIME_REASSIGNED)
        ->and($conflict->reassigned_resource_id)->toBe($second->id)
        ->and($conflict->original_resource_id)->toBe($shop->records->resource->id);
    Mail::assertNothingQueued();
});

test('a reassignment can use a different compatible resource type', function () {
    $shop = Shop::make(capacity: 1);
    $lift = Tenant::make(ResourceType::class, ['organization_id' => $shop->organization->id, 'branch_id' => $shop->organization->branch()->value('id'), 'name' => 'Lift']);
    $liftBay = $shop->resource('Lift 1', 1, $lift->id);
    Tenant::make(CapacityConsumption::class, ['organization_id' => $shop->organization->id, 'service_vehicle_variant_id' => $shop->records->variant->id, 'resource_type_id' => $lift->id, 'units' => 1]);
    $booking = $shop->booking('2026-10-05 10:00');

    confirmedBlock($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00');

    $fresh = $booking->fresh();
    expect($fresh->physical_resource_id)->toBe($liftBay->id)
        // The booking's own fulfillment snapshot is untouched.
        ->and($fresh->resource_type_id)->toBe($shop->records->type->id)
        ->and($fresh->resource_type_name)->toBe('Wash bay');
});

test('a plan keeps undisturbed bookings and never over-allocates a resource', function () {
    $shop = Shop::make(capacity: 1);
    $second = $shop->resource('Bay 2', 1);
    $disrupted = $shop->booking('2026-10-05 10:00');
    $undisturbed = $shop->booking('2026-10-05 10:00', resource: $second);
    $third = $shop->booking('2026-10-05 10:30');   // also on Bay 1, overlaps the first

    $preview = blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00');
    $impact = session('scheduling_impact');

    // Bay 2 is held by the undisturbed booking, so neither disrupted booking can move there.
    expect($impact['affected'])->toBe(2)->and($impact['conflicts'])->toBe(2)->and($impact['reassigned'])->toBe(0);
    confirmedBlock($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00');
    expect($undisturbed->fresh()->physical_resource_id)->toBe($second->id)
        ->and(SchedulingConflict::query()->where('booking_id', $undisturbed->id)->exists())->toBeFalse()
        ->and(SchedulingConflict::query()->where('status', 'open')->pluck('booking_id')->sort()->values()->all())->toBe(collect([$disrupted->id, $third->id])->sort()->values()->all());
});

test('a stale or altered confirmation cannot be applied', function () {
    $shop = Shop::make(capacity: 1);
    $shop->booking('2026-10-05 10:00');
    $staff = $shop->member(Membership::STAFF);

    blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00', as: $staff);
    $token = session('scheduling_impact.token');

    // Altered payload: the token was minted for a different reason/window.
    blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00', ['impact_token' => $token, 'reason' => 'Something else'], $staff)
        ->assertSessionHas('scheduling_impact', fn (array $impact) => $impact['stale'] === true);
    blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 13:00', ['impact_token' => $token], $staff)->assertSessionHas('scheduling_impact');
    // Forged token.
    blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00', ['impact_token' => str_repeat('a', 64)], $staff)->assertSessionHas('scheduling_impact');
    expect(ResourceBlock::query()->count())->toBe(0);

    // The world changes after the review: another booking is now disrupted too, so the plan differs.
    $shop->booking('2026-10-05 11:00');
    blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00', ['impact_token' => $token], $staff)
        ->assertSessionHas('scheduling_impact', fn (array $impact) => $impact['affected'] === 2 && $impact['stale'] === true);
    expect(ResourceBlock::query()->count())->toBe(0)->and(SchedulingConflict::query()->count())->toBe(0);

    // A token minted for another actor is not valid either.
    $other = $shop->member(Membership::STAFF);
    blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00', as: $staff);
    $fresh = session('scheduling_impact.token');
    blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00', ['impact_token' => $fresh], $other)->assertSessionHas('scheduling_impact');
    expect(ResourceBlock::query()->count())->toBe(0);
});

test('a change with no future impact saves directly and an explicit preview writes nothing', function () {
    $shop = Shop::make(capacity: 1);
    $staff = $shop->member(Membership::STAFF);

    blockResource($shop, $shop->records->resource, '2026-10-05 09:00', '2026-10-05 12:00', as: $staff)->assertSessionMissing('scheduling_impact')->assertSessionHasNoErrors();
    expect(ResourceBlock::query()->count())->toBe(1);

    $this->actingAs($shop->owner)->putJson(route('owner.settings.hours.update', $shop->organization), [
        'weekly' => [['weekday' => 1, 'opens_at' => '08:00', 'closes_at' => '18:00']], 'overrides' => [], 'preview_impact' => true,
    ])->assertStatus(409)->assertJsonPath('impact.preview', true)->assertJsonPath('impact.affected', 0);
    expect(BranchWeeklyHour::query()->where('organization_id', $shop->organization->id)->count())->toBe(7);
});

test('an hours change that closes a booked time raises an hours conflict only after confirmation', function () {
    $shop = Shop::make(capacity: 2);
    $booking = $shop->booking('2026-10-05 16:00');   // 16:00-17:00 service
    $weekly = collect(range(1, 7))->map(fn (int $day) => ['weekday' => $day, 'opens_at' => '08:00', 'closes_at' => $day === 1 ? '16:30' : '18:00'])->all();
    $payload = ['weekly' => $weekly, 'overrides' => []];

    $this->actingAs($shop->owner)->put(route('owner.settings.hours.update', $shop->organization), $payload)
        ->assertSessionHas('scheduling_impact', fn (array $impact) => $impact['affected'] === 1 && $impact['bookings'][0]['cause'] === 'hours');
    expect(BranchWeeklyHour::query()->where('weekday', 1)->value('closes_at'))->toStartWith('18:00')->and(SchedulingConflict::query()->count())->toBe(0);

    $this->actingAs($shop->owner)->put(route('owner.settings.hours.update', $shop->organization), $payload + ['impact_token' => session('scheduling_impact.token')])->assertSessionHasNoErrors();
    expect(BranchWeeklyHour::query()->where('weekday', 1)->value('closes_at'))->toStartWith('16:30')
        ->and(conflictOf($booking)->cause)->toBe('hours')
        ->and($booking->fresh()->scheduled_start_at->equalTo(Shop::at('2026-10-05 16:00')))->toBeTrue();
});

test('a service-window change that no longer covers a booking is a conflict', function () {
    $shop = Shop::make(capacity: 2);
    $booking = $shop->booking('2026-10-05 15:00');
    $windows = collect(range(1, 7))->map(fn (int $day) => ['weekday' => $day, 'starts_at' => '09:00', 'ends_at' => $day === 1 ? '15:30' : '17:00'])->all();
    $url = route('owner.settings.services.windows', [$shop->organization, $shop->records->service]);

    $this->actingAs($shop->owner)->put($url, ['windows' => $windows])->assertSessionHas('scheduling_impact');
    $this->actingAs($shop->owner)->put($url, ['windows' => $windows, 'impact_token' => session('scheduling_impact.token')])->assertSessionHasNoErrors();

    expect(conflictOf($booking)->cause)->toBe('hours');
});

test('a capacity decrease flags only the booking that no longer fits', function () {
    $shop = Shop::make(capacity: 2);
    $first = $shop->booking('2026-10-05 10:00');
    $second = $shop->booking('2026-10-05 10:30');
    $url = route('owner.settings.resources.update', [$shop->organization, $shop->records->resource]);
    $payload = ['name' => 'Bay 1', 'capacity' => 1, 'is_active' => true];

    $this->actingAs($shop->owner)->patch($url, $payload)->assertSessionHas('scheduling_impact', fn (array $impact) => $impact['affected'] === 1 && $impact['bookings'][0]['cause'] === 'capacity');
    expect($shop->records->resource->fresh()->capacity)->toBe(2);

    $this->actingAs($shop->owner)->patch($url, $payload + ['impact_token' => session('scheduling_impact.token')])->assertSessionHasNoErrors();
    expect($shop->records->resource->fresh()->capacity)->toBe(1)
        ->and(SchedulingConflict::query()->where('booking_id', $first->id)->exists())->toBeFalse()
        ->and(conflictOf($second)->cause)->toBe('capacity');
});

test('deactivating or archiving a resource and removing a compatibility are assessed', function () {
    $shop = Shop::make(capacity: 1);
    $other = $shop->resource('Bay 2', 1);
    $booking = $shop->booking('2026-10-05 10:00');
    $url = route('owner.settings.resources.update', [$shop->organization, $shop->records->resource]);
    $payload = ['name' => 'Bay 1', 'capacity' => 1, 'is_active' => false];

    // Deactivating Bay 1 moves the booking to Bay 2 at the same time.
    $this->actingAs($shop->owner)->patch($url, $payload)->assertSessionHas('scheduling_impact', fn (array $impact) => $impact['reassigned'] === 1 && $impact['bookings'][0]['cause'] === 'resource_unavailable' && $impact['bookings'][0]['toResource'] === 'Bay 2');
    $this->actingAs($shop->owner)->patch($url, $payload + ['impact_token' => session('scheduling_impact.token')])->assertSessionHasNoErrors();
    expect($booking->fresh()->physical_resource_id)->toBe($other->id)->and(conflictOf($booking)->resolution)->toBe('same_time_reassigned');

    // Archiving the only remaining resource type leaves nothing compatible: a conflict.
    $archive = route('owner.settings.resource-types.archive', [$shop->organization, $shop->records->type]);
    $this->actingAs($shop->owner)->post($archive)->assertSessionHas('scheduling_impact', fn (array $impact) => $impact['conflicts'] === 1);
    $this->actingAs($shop->owner)->post($archive, ['impact_token' => session('scheduling_impact.token')])->assertSessionHasNoErrors();
    expect(SchedulingConflict::query()->where('booking_id', $booking->id)->where('status', 'open')->value('cause'))->toBe('resource_unavailable');
});

test('replacing the variant consumption rules reassigns or conflicts by compatibility', function () {
    $shop = Shop::make(capacity: 1);
    $lift = Tenant::make(ResourceType::class, ['organization_id' => $shop->organization->id, 'branch_id' => $shop->organization->branch()->value('id'), 'name' => 'Lift']);
    $liftBay = $shop->resource('Lift 1', 1, $lift->id);
    $booking = $shop->booking('2026-10-05 10:00');
    $url = route('owner.settings.variants.consumption', [$shop->organization, $shop->records->service, $shop->records->variant]);
    $payload = ['rules' => [['resource_type_id' => $lift->id, 'units' => 1]]];

    $this->actingAs($shop->owner)->put($url, $payload)->assertSessionHas('scheduling_impact', fn (array $impact) => $impact['reassigned'] === 1 && $impact['bookings'][0]['cause'] === 'compatibility');
    expect(CapacityConsumption::query()->where('service_vehicle_variant_id', $shop->records->variant->id)->value('resource_type_id'))->toBe($shop->records->type->id);

    $this->actingAs($shop->owner)->put($url, $payload + ['impact_token' => session('scheduling_impact.token')])->assertSessionHasNoErrors();
    expect($booking->fresh()->physical_resource_id)->toBe($liftBay->id);
});

test('only active owners change scheduling configuration while staff and outsiders stay out', function () {
    $shop = Shop::make(capacity: 1);
    $shop->booking('2026-10-05 10:00');
    $url = route('owner.settings.resources.update', [$shop->organization, $shop->records->resource]);

    $this->actingAs($shop->member(Membership::STAFF))->patch($url, ['name' => 'Bay 1', 'capacity' => 1, 'is_active' => false])->assertForbidden();
    $this->actingAs(Shop::make('foreign')->owner)->patch($url, ['name' => 'Bay 1', 'capacity' => 1, 'is_active' => false])->assertNotFound();
    expect($shop->records->resource->fresh()->is_active)->toBeTrue();
});

test('releasing a block never closes an open conflict', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);

    $this->actingAs($shop->owner)->post(route('owner.operations.blocks.release', [$shop->organization, ResourceBlock::query()->sole()->public_id]))->assertSessionHasNoErrors();

    expect($conflict->fresh()->status)->toBe(SchedulingConflict::OPEN)->and($booking->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('the conflict dashboard lists unresolved and recent conflicts for members only', function () {
    $booking = conflicted($shop);
    $other = Shop::make('foreign');
    $staff = $shop->member(Membership::STAFF);

    $this->actingAs($staff)->withoutVite()->get(route('owner.scheduling-conflicts.index', [$shop->organization, 'conflict' => conflictOf($booking)->public_id]))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('owner/scheduling-conflicts')
            ->has('unresolved', 1)
            ->where('unresolved.0.status', 'open')
            ->where('unresolved.0.cause', 'resource_blocked')
            ->where('unresolved.0.booking.customerName', 'Ana Cruz')
            ->where('unresolved.0.originalResource', 'Bay 1')
            ->where('unresolved.0.actions.propose', true)
            ->where('counts.needsProposal', 1)
            ->where('organization.unresolvedConflicts', 1)
            ->has('candidates.times')
            ->where('candidates.times.0.resource', 'Bay 1'));
    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.scheduling-conflicts.index', $shop->organization))->assertOk();
    $this->actingAs($other->owner)->get(route('owner.scheduling-conflicts.index', $shop->organization))->assertNotFound();

    $inactive = $shop->member(Membership::STAFF);
    Membership::query()->where('user_id', $inactive->id)->update(['is_active' => false]);
    $this->actingAs($inactive)->get(route('owner.scheduling-conflicts.index', $shop->organization))->assertNotFound();
    $this->actingAs($staff)->get(route('owner.settings.hours', $shop->organization))->assertForbidden();
});

test('another tenant cannot read or act on a conflict by id', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    $other = Shop::make('foreign');

    propose($shop, $conflict, '2026-10-05 14:00', as: $other->owner)->assertNotFound();
    $this->actingAs($other->owner)->post(route('owner.scheduling-conflicts.proposal.store', [$other->organization, $conflict->public_id]), ['revision' => 1, 'idempotency_key' => (string) Str::uuid(), 'start_at' => Shop::at('2026-10-05 14:00')->toIso8601String()])->assertNotFound();
    $this->actingAs($other->owner)->post(route('owner.scheduling-conflicts.proposal.withdraw', [$other->organization, $conflict->public_id]), ['revision' => 1, 'idempotency_key' => (string) Str::uuid()])->assertNotFound();
    expect(ConflictProposal::query()->count())->toBe(0);
});

test('a proposal holds its slot beside the original booking and only notifies the customer then', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    Mail::fake();

    propose($shop, $conflict, '2026-10-05 14:00')->assertSessionHasNoErrors()->assertSessionHas('status');

    $proposal = ConflictProposal::query()->sole();
    expect($proposal->status)->toBe(ConflictProposal::ACTIVE)
        ->and($proposal->proposed_start_at->equalTo(Shop::at('2026-10-05 14:00')))->toBeTrue()
        ->and($proposal->expires_at->equalTo(Shop::at('2026-10-05 10:00')))->toBeTrue()
        ->and($conflict->fresh()->status)->toBe(SchedulingConflict::AWAITING_CUSTOMER)
        // The proposed time is never a confirmed booking.
        ->and(Booking::query()->count())->toBe(1)
        ->and($booking->fresh()->status)->toBe(Booking::CONFIRMED)
        ->and($booking->fresh()->scheduled_start_at->equalTo(Shop::at('2026-10-05 10:00')))->toBeTrue()
        ->and(feasible($shop, '2026-10-05 14:00'))->toBeFalse();
    Mail::assertQueued(SchedulingProposalMail::class, 1);
    expect(AuditEvent::query()->where('action', 'scheduling_conflict.proposal_sent')->count())->toBe(1);
});

test('a proposal cannot overbook a time, an unavailable time or the current appointment', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    $shop->booking('2026-10-05 14:00');   // takes the only unit at 14:00
    Mail::fake();

    propose($shop, $conflict, '2026-10-05 14:00')->assertSessionHasErrors('start_at');
    propose($shop, $conflict, '2026-10-05 20:00')->assertSessionHasErrors('start_at');
    propose($shop, $conflict, '2026-10-05 10:00')->assertSessionHasErrors('start_at');
    expect(ConflictProposal::query()->count())->toBe(0)->and($conflict->fresh()->status)->toBe(SchedulingConflict::OPEN);
    Mail::assertNothingQueued();
});

test('replacing a proposal secures the new slot first and leaves one active proposal', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    propose($shop, $conflict, '2026-10-05 12:30');
    $first = ConflictProposal::query()->sole();

    // A failing replacement leaves the existing proposal intact.
    $shop->booking('2026-10-05 15:30');
    propose($shop, $conflict, '2026-10-05 16:00')->assertSessionHasErrors('start_at');
    expect($first->fresh()->status)->toBe(ConflictProposal::ACTIVE);

    propose($shop, $conflict, '2026-10-05 14:00')->assertSessionHasNoErrors();
    expect($first->fresh()->status)->toBe(ConflictProposal::REPLACED)
        ->and(ConflictProposal::query()->where('status', 'active')->count())->toBe(1)
        ->and(feasible($shop, '2026-10-05 12:30'))->toBeTrue()
        ->and(feasible($shop, '2026-10-05 14:00'))->toBeFalse()
        ->and(ConflictEvent::query()->where('conflict_id', $conflict->id)->pluck('event')->all())->toBe(['detected', 'proposal_sent', 'proposal_replaced']);

    // The database itself refuses a second active proposal for the booking.
    expect(fn () => DB::table('scheduling_conflict_proposals')->insert([
        'organization_id' => $shop->organization->id, 'public_id' => (string) Str::uuid(), 'conflict_id' => $conflict->id, 'booking_id' => $booking->id,
        'physical_resource_id' => $shop->records->resource->id, 'resource_type_id' => $shop->records->type->id, 'units' => 1,
        'proposed_start_at' => Shop::at('2026-10-06 10:00'), 'proposed_service_end_at' => Shop::at('2026-10-06 11:00'), 'occupied_end_at' => Shop::at('2026-10-06 11:10'),
        'status' => 'active', 'expires_at' => Shop::at('2026-10-05 10:00'), 'created_by_user_id' => $shop->owner->id, 'created_at' => now(), 'updated_at' => now(),
    ]))->toThrow(QueryException::class);
});

test('proposal requests are idempotent and reject stale revisions', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    $key = (string) Str::uuid();
    $staff = $shop->member(Membership::STAFF);
    Mail::fake();

    propose($shop, $conflict, '2026-10-05 14:00', ['idempotency_key' => $key], $staff)->assertSessionHasNoErrors();
    propose($shop, $conflict->fresh(), '2026-10-05 14:00', ['idempotency_key' => $key, 'revision' => 1], $staff)->assertSessionHasNoErrors();
    expect(ConflictProposal::query()->count())->toBe(1);
    Mail::assertQueued(SchedulingProposalMail::class, 1);

    propose($shop, $conflict, '2026-10-05 16:00', ['idempotency_key' => $key, 'revision' => 1], $staff)->assertSessionHasErrors('idempotency_key');
    propose($shop, $conflict, '2026-10-05 16:00', ['revision' => 1], $staff)->assertSessionHasErrors('revision');
    expect(ConflictProposal::query()->count())->toBe(1);
});

test('withdrawing a proposal frees only its hold and returns the conflict to staff', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    propose($shop, $conflict, '2026-10-05 14:00');
    $proposal = ConflictProposal::query()->sole();

    $this->actingAs($shop->member(Membership::STAFF))->post(route('owner.scheduling-conflicts.proposal.withdraw', [$shop->organization, $conflict->public_id]), ['revision' => $conflict->fresh()->revision, 'idempotency_key' => (string) Str::uuid()])->assertSessionHasNoErrors();

    expect($proposal->fresh()->status)->toBe(ConflictProposal::WITHDRAWN)
        ->and($conflict->fresh()->status)->toBe(SchedulingConflict::OPEN)
        ->and(feasible($shop, '2026-10-05 14:00'))->toBeTrue()
        ->and($booking->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('the owning customer accepts: exactly one confirmed replacement and the original is rescheduled', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    propose($shop, $conflict, '2026-10-05 14:00');
    $proposal = ConflictProposal::query()->sole();
    Mail::fake();

    respond($shop, $booking, 'accept', $proposal)->assertSessionHasNoErrors()->assertRedirect();

    $replacement = Booking::query()->where('id', '!=', $booking->id)->sole();
    expect($replacement->status)->toBe(Booking::CONFIRMED)
        ->and($replacement->scheduled_start_at->equalTo(Shop::at('2026-10-05 14:00')))->toBeTrue()
        ->and($replacement->total_price_centavos)->toBe($booking->total_price_centavos)
        ->and($replacement->customer_user_id)->toBe($booking->customer_user_id)
        ->and($booking->fresh()->status)->toBe(Booking::RESCHEDULED)
        ->and($booking->fresh()->rescheduled_to_booking_id)->toBe($replacement->id)
        ->and($proposal->fresh()->status)->toBe(ConflictProposal::ACCEPTED)
        ->and($proposal->fresh()->replacement_booking_id)->toBe($replacement->id)
        ->and($conflict->fresh()->status)->toBe(SchedulingConflict::RESOLVED)
        ->and($conflict->fresh()->resolution)->toBe(SchedulingConflict::CUSTOMER_ACCEPTED);
    Mail::assertQueued(BookingConfirmedMail::class, 1);

    // A repeated answer with the same key replays; a new key is refused.
    $key = (string) Str::uuid();
    respond($shop, $booking, 'accept', $proposal->fresh(), ['idempotency_key' => $key, 'revision' => 1])->assertSessionHasErrors('proposal');
    expect(Booking::query()->count())->toBe(2);
});

test('an accept replays safely with the same key', function () {
    $booking = conflicted($shop);
    propose($shop, conflictOf($booking), '2026-10-05 14:00');
    $proposal = ConflictProposal::query()->sole();
    $key = (string) Str::uuid();

    respond($shop, $booking, 'accept', $proposal, ['idempotency_key' => $key, 'revision' => 1])->assertSessionHasNoErrors();
    respond($shop, $booking, 'accept', $proposal, ['idempotency_key' => $key, 'revision' => 1])->assertSessionHasNoErrors();

    expect(Booking::query()->count())->toBe(2)->and(ConflictEvent::query()->where('event', 'proposal_accepted')->count())->toBe(1);
});

test('declining leaves the original booking and returns the conflict to staff', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    propose($shop, $conflict, '2026-10-05 14:00');
    $proposal = ConflictProposal::query()->sole();

    respond($shop, $booking, 'decline', $proposal)->assertSessionHasNoErrors();

    expect($proposal->fresh()->status)->toBe(ConflictProposal::DECLINED)
        ->and($conflict->fresh()->status)->toBe(SchedulingConflict::OPEN)
        ->and($conflict->fresh()->reopened_at)->not->toBeNull()
        ->and($booking->fresh()->status)->toBe(Booking::CONFIRMED)
        ->and($booking->fresh()->scheduled_start_at->equalTo(Shop::at('2026-10-05 10:00')))->toBeTrue()
        ->and(Booking::query()->count())->toBe(1)
        ->and(feasible($shop, '2026-10-05 14:00'))->toBeTrue();
    Mail::assertNotQueued(BookingConfirmedMail::class);
    // Staff can propose again after a decline.
    propose($shop, $conflict, '2026-10-05 16:00')->assertSessionHasNoErrors();
});

test('only the owning customer can answer and nothing leaks resource detail', function () {
    $booking = conflicted($shop);
    propose($shop, conflictOf($booking), '2026-10-05 14:00');
    $proposal = ConflictProposal::query()->sole();
    $stranger = Tenant::user('stranger@example.test');

    respond($shop, $booking, 'accept', $proposal, as: $stranger)->assertNotFound();
    respond($shop, $booking, 'decline', $proposal, as: $stranger)->assertNotFound();
    respond($shop, $booking, 'accept', $proposal, as: $shop->member(Membership::STAFF))->assertNotFound();
    expect($proposal->fresh()->status)->toBe(ConflictProposal::ACTIVE);

    $page = $this->actingAs(User::query()->findOrFail($booking->customer_user_id))->withoutVite()->get(route('bookings.show', [$shop->organization->slug, $booking->public_id]));
    $page->assertInertia(fn (Assert $assert) => $assert->where('booking.proposal.id', $proposal->public_id)
        ->where('booking.proposal.revision', 1)
        ->has('booking.proposal', 4)
        ->where('booking.actions.canReschedule', false)
        ->where('booking.status', 'confirmed'));
    expect(json_encode($page->viewData('page')['props']['booking']))->not->toContain('Bay 1')->not->toContain('resource')->not->toContain('capacity');

    $this->actingAs($stranger)->withoutVite()->get(route('bookings.show', [$shop->organization->slug, $booking->public_id]))->assertNotFound();
});

test('self-service reschedule is refused while a staff proposal is pending', function () {
    $booking = conflicted($shop);
    propose($shop, conflictOf($booking), '2026-10-05 14:00');

    $this->actingAs(User::query()->findOrFail($booking->customer_user_id))->post(route('bookings.reschedule', [$shop->organization->slug, $booking->public_id]), [
        'revision' => $booking->fresh()->revision, 'idempotency_key' => (string) Str::uuid(), 'start_at' => Shop::at('2026-10-05 16:00')->toIso8601String(),
    ])->assertSessionHasErrors('booking');
    expect(Booking::query()->count())->toBe(1);
});

test('an expired proposal releases only its hold, keeps the booking and cannot be accepted', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    propose($shop, $conflict, '2026-10-05 14:00');
    $proposal = ConflictProposal::query()->sole();

    // Capacity frees at the deadline even before the sweeper runs, and the late answer is refused.
    $this->travelTo(Shop::at('2026-10-05 10:01'));
    expect(feasible($shop, '2026-10-05 14:00'))->toBeTrue();
    respond($shop, $booking, 'accept', $proposal)->assertSessionHasErrors('proposal');
    expect(Booking::query()->count())->toBe(1)
        ->and($proposal->fresh()->status)->toBe(ConflictProposal::EXPIRED)
        ->and($conflict->fresh()->status)->toBe(SchedulingConflict::OPEN)
        ->and($booking->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('the sweeper expires overdue proposals idempotently and closes conflicts of ended bookings', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    propose($shop, $conflict, '2026-10-05 14:00');

    expect(app(ExpireConflictProposals::class)->handle())->toBe(['expired' => 0, 'closed' => 0]);
    $this->travelTo(Shop::at('2026-10-05 10:01'));
    expect(app(ExpireConflictProposals::class)->handle())->toBe(['expired' => 1, 'closed' => 0])
        ->and(app(ExpireConflictProposals::class)->handle())->toBe(['expired' => 0, 'closed' => 0]);
    expect(ConflictProposal::query()->sole()->status)->toBe(ConflictProposal::EXPIRED)
        ->and($conflict->fresh()->status)->toBe(SchedulingConflict::OPEN)
        ->and(ConflictEvent::query()->where('conflict_id', $conflict->id)->pluck('event')->all())->toBe(['detected', 'proposal_sent', 'proposal_expired']);

    $second = $shop->booking('2026-10-06 10:00');
    SchedulingConflict::query()->create([
        'organization_id' => $shop->organization->id, 'public_id' => (string) Str::uuid(), 'booking_id' => $second->id, 'status' => 'open', 'cause' => 'capacity', 'source' => 'test',
        'context' => [], 'original_resource_id' => $shop->records->resource->id, 'detected_at' => now(),
    ]);
    $second->forceFill(['status' => Booking::EXPIRED])->save();
    expect(app(ExpireConflictProposals::class)->handle()['closed'])->toBe(1)
        ->and(conflictOf($second)->resolution)->toBe(SchedulingConflict::BOOKING_CLOSED);
});

test('accepting is refused when the held slot disappeared and the conflict returns to staff', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    propose($shop, $conflict, '2026-10-05 14:00');
    $proposal = ConflictProposal::query()->sole();
    // The owner then blocks the proposed slot's resource: the held slot is no longer valid.
    ResourceBlock::query()->create(['organization_id' => $shop->organization->id, 'public_id' => (string) Str::uuid(), 'physical_resource_id' => $shop->records->resource->id, 'starts_at' => Shop::at('2026-10-05 13:00'), 'ends_at' => Shop::at('2026-10-05 15:00'), 'reason' => 'x', 'created_by_user_id' => $shop->owner->id]);

    respond($shop, $booking, 'accept', $proposal)->assertSessionHasErrors('proposal');

    expect(Booking::query()->count())->toBe(1)
        ->and($proposal->fresh()->status)->toBe(ConflictProposal::WITHDRAWN)
        ->and($conflict->fresh()->status)->toBe(SchedulingConflict::OPEN)
        ->and($booking->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('cancelling a conflicted booking closes the conflict and releases its proposal', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);
    propose($shop, $conflict, '2026-10-05 14:00');

    $this->actingAs(User::query()->findOrFail($booking->customer_user_id))->post(route('bookings.cancel', [$shop->organization->slug, $booking->public_id]), [
        'revision' => $booking->fresh()->revision, 'idempotency_key' => (string) Str::uuid(),
    ])->assertSessionHasNoErrors();

    expect($conflict->fresh()->status)->toBe(SchedulingConflict::RESOLVED)
        ->and($conflict->fresh()->resolution)->toBe(SchedulingConflict::BOOKING_CLOSED)
        ->and(ConflictProposal::query()->sole()->status)->toBe(ConflictProposal::WITHDRAWN)
        ->and(feasible($shop, '2026-10-05 14:00'))->toBeTrue();
});

test('conflict history is append-only and states are constrained by the database', function () {
    $booking = conflicted($shop);
    $conflict = conflictOf($booking);

    expect(fn () => DB::table('scheduling_conflict_events')->where('conflict_id', $conflict->id)->update(['event' => 'x']))->toThrow(QueryException::class);
    expect(fn () => DB::table('scheduling_conflict_events')->where('conflict_id', $conflict->id)->delete())->toThrow(QueryException::class);
    // Resolved needs a resolution; a booking can have only one unresolved conflict.
    expect(fn () => DB::table('scheduling_conflicts')->where('id', $conflict->id)->update(['status' => 'resolved']))->toThrow(QueryException::class);
    expect(fn () => SchedulingConflict::query()->create([
        'organization_id' => $shop->organization->id, 'public_id' => (string) Str::uuid(), 'booking_id' => $booking->id, 'status' => 'open', 'cause' => 'capacity', 'source' => 'test',
        'context' => [], 'original_resource_id' => $shop->records->resource->id, 'detected_at' => now(),
    ]))->toThrow(QueryException::class);
});

test('a booking with an open conflict is not re-planned and still holds its slot', function () {
    $booking = conflicted($shop);
    $second = $shop->resource('Bay 2', 1);

    // Another change touching nothing relevant must not move or duplicate the conflicted booking.
    $this->actingAs($shop->owner)->patch(route('owner.settings.resources.update', [$shop->organization, $second]), ['name' => 'Bay 2 renamed', 'capacity' => 1, 'is_active' => true])->assertSessionHasNoErrors();

    expect(SchedulingConflict::query()->where('booking_id', $booking->id)->count())->toBe(1)
        ->and($booking->fresh()->physical_resource_id)->toBe($shop->records->resource->id);
});
