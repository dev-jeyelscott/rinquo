<?php

use App\Modules\Booking\Availability\AvailabilitySearch;
use App\Modules\Booking\Mail\BookingApprovedMail;
use App\Modules\Booking\Mail\BookingDeclinedMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Tenancy\Models\AuditEvent;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Mail;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Shop;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
});

function pendingRequest(Shop $shop, string $start = '2026-10-06 10:00'): Booking
{
    return $shop->booking($start, Booking::PENDING_APPROVAL, attributes: ['approval_mode' => 'staff_approval']);
}

function decide(Shop $shop, Booking $booking, string $decision, array $data = [])
{
    return test()->post(route("owner.booking-requests.{$decision}", [$shop->organization, $booking->public_id]), $data);
}

test('the owner sees pending requests with their details', function () {
    $shop = Shop::make();
    $request = pendingRequest($shop);
    $shop->booking('2026-10-06 13:00');                                                  // confirmed: not listed
    $shop->booking('2026-10-06 15:00', Booking::PENDING_APPROVAL, attributes: ['pending_expires_at' => now()->subMinute()]); // lapsed: not listed

    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.booking-requests.index', $shop->organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('owner/booking-requests')
            ->has('requests', 1)
            ->where('requests.0.id', $request->public_id)
            ->where('requests.0.customerName', 'Ana Cruz')
            ->where('requests.0.serviceName', 'Full wash')
            ->where('requests.0.timezone', 'Asia/Manila')
            ->where('organization.bookingRequestsUrl', "/owner/organizations/{$shop->organization->id}/booking-requests"));
});

test('the list is bounded and paginated', function () {
    $shop = Shop::make(capacity: 99);
    foreach (range(0, 21) as $minutes) {
        $shop->booking('2026-10-06 10:00', Booking::PENDING_APPROVAL, attributes: ['pending_expires_at' => now()->addMinutes(30 + $minutes)]);
    }

    $this->actingAs($shop->owner)->withoutVite()->get(route('owner.booking-requests.index', $shop->organization))
        ->assertInertia(fn (Assert $page) => $page->has('requests', 20)->where('pagination.nextUrl', fn ($url) => $url !== null)->where('pagination.previousUrl', null));
});

test('approval keeps the capacity, confirms the booking, audits and emails the customer', function () {
    $shop = Shop::make(capacity: 1);
    $request = pendingRequest($shop);
    $snapshot = collect($request->fresh()->getAttributes())->only(['service_name', 'total_price_centavos', 'scheduled_start_at', 'approval_mode'])->all();

    $this->actingAs($shop->owner);
    decide($shop, $request, 'approve')->assertSessionHasNoErrors()->assertSessionHas('status');

    $request->refresh();
    expect($request->status)->toBe(Booking::CONFIRMED)->and($request->confirmed_at)->not->toBeNull()
        ->and($request->decided_by_user_id)->toBe($shop->owner->id)->and($request->decided_at)->not->toBeNull()
        ->and(collect($request->getAttributes())->only(array_keys($snapshot))->all())->toEqual($snapshot);
    Mail::assertQueued(BookingApprovedMail::class, fn ($mail) => $mail->hasTo($request->contact_email));
    expect(AuditEvent::query()->where('action', 'booking.approved')->sole()->subject_id)->toBe($request->id);

    // The approved booking still holds the capacity.
    $times = app(AvailabilitySearch::class)->feasibleClaim($shop->organization, $shop->records->variant, new Collection, Shop::at('2026-10-06 10:00'));
    expect($times)->toBeNull();
});

test('declining releases the capacity, audits the reason and emails the customer', function () {
    $shop = Shop::make(capacity: 1);
    $request = pendingRequest($shop);
    $this->actingAs($shop->owner);

    decide($shop, $request, 'decline', ['reason' => 'Fully booked for a private event'])->assertSessionHasNoErrors();

    expect($request->fresh()->status)->toBe(Booking::DECLINED);
    Mail::assertQueued(BookingDeclinedMail::class, 1);
    $event = AuditEvent::query()->where('action', 'booking.declined')->sole();
    expect($event->after)->toEqual(['status' => 'declined', 'reason' => 'Fully booked for a private event']);

    $claim = app(AvailabilitySearch::class)->feasibleClaim($shop->organization, $shop->records->variant, new Collection, Shop::at('2026-10-06 10:00'));
    expect($claim)->not->toBeNull();
});

test('the decline reason is bounded', function () {
    $shop = Shop::make();
    $request = pendingRequest($shop);
    $this->actingAs($shop->owner);

    decide($shop, $request, 'decline', ['reason' => str_repeat('x', 501)])->assertSessionHasErrors('reason');
    expect($request->fresh()->status)->toBe(Booking::PENDING_APPROVAL);
});

test('an expired request cannot be approved or declined', function () {
    $shop = Shop::make();
    $request = pendingRequest($shop);
    $this->actingAs($shop->owner);
    $this->travel(3)->hours();

    decide($shop, $request, 'approve')->assertSessionHasErrors(['booking' => 'This request already expired or was decided.']);
    decide($shop, $request, 'decline')->assertSessionHasErrors('booking');

    expect($request->fresh()->status)->toBe(Booking::PENDING_APPROVAL);
    Mail::assertNothingQueued();
});

test('a request is decided at most once and repeating the same decision is a no-op', function () {
    $shop = Shop::make();
    $request = pendingRequest($shop);
    $this->actingAs($shop->owner);

    decide($shop, $request, 'approve');
    decide($shop, $request, 'approve')->assertSessionHasNoErrors();
    Mail::assertQueued(BookingApprovedMail::class, 1);
    expect(AuditEvent::query()->where('action', 'booking.approved')->count())->toBe(1);

    // The opposite decision after the fact is refused.
    decide($shop, $request, 'decline')->assertSessionHasErrors('booking');
    expect($request->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('staff members may decide requests, strangers and other tenants may not', function () {
    $shop = Shop::make();
    $rival = Shop::make('rival');
    $request = pendingRequest($shop);

    $this->actingAs($rival->owner);
    $this->get(route('owner.booking-requests.index', $shop->organization))->assertNotFound();
    decide($shop, $request, 'approve')->assertNotFound();
    $this->actingAs(Tenant::user('stranger@example.test'));
    decide($shop, $request, 'approve')->assertNotFound();
    expect($request->fresh()->status)->toBe(Booking::PENDING_APPROVAL);

    $this->actingAs($shop->member('staff'));
    decide($shop, $request, 'approve')->assertSessionHasNoErrors();
    expect($request->fresh()->status)->toBe(Booking::CONFIRMED);
});

test('guests are redirected to sign in', function () {
    $shop = Shop::make();
    $request = pendingRequest($shop);

    $this->get(route('owner.booking-requests.index', $shop->organization))->assertRedirect(route('owner.auth.login'));
    decide($shop, $request, 'approve')->assertRedirect(route('owner.auth.login'));
});

test('a booking id from another organization is a not-found even for a member', function () {
    $shop = Shop::make();
    $rival = Shop::make('rival');
    $foreign = pendingRequest($rival);

    $this->actingAs($shop->owner);
    decide($shop, $foreign, 'approve')->assertNotFound();
    expect($foreign->fresh()->status)->toBe(Booking::PENDING_APPROVAL);
});

test('a malformed booking id on the decision routes is a plain 404', function () {
    $shop = Shop::make('pending')->policy(['approval_mode' => 'staff_approval']);

    foreach (['approve', 'decline'] as $decision) {
        $this->actingAs($shop->owner)->post(route("owner.booking-requests.{$decision}", [$shop->organization, 'x']))->assertNotFound();
    }
});
