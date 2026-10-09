<?php

use App\Modules\Booking\Mail\BookingConfirmedMail;
use App\Modules\Booking\Mail\BookingRequestReceivedMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\BookingAddOn;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Support\BookingNotifier;
use App\Modules\Customer\Models\CustomerVehicle;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Journey;
use Tests\Support\Shop;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
    RateLimiter::clear('booking-holds');
    RateLimiter::clear('booking-confirm');
});

/** A signed-in customer with a held time and saved details; returns [shop, hold, customer]. */
function readyToConfirm(array $shopArgs = [], string $start = '2026-10-06 10:00', array $addOnIds = [], ?Shop $shop = null): array
{
    $shop ??= Shop::make(...$shopArgs);
    $customer = Tenant::user('customer-'.Str::lower(Str::random(5)).'@example.test');
    test()->actingAs($customer);
    $hold = Journey::hold($shop, $start, $addOnIds);
    Journey::saveDetails($shop, $hold)->assertSessionHasNoErrors();

    return [$shop, $hold, $customer];
}

test('instant confirmation creates one confirmed booking with the full snapshot', function () {
    $shop = Shop::make();
    $wax = $shop->addOn('Wax', 15000, 20);
    [, $hold, $customer] = readyToConfirm(shop: $shop, addOnIds: [$wax->id]);

    Journey::confirm($shop, $hold)->assertSessionHasNoErrors();

    $booking = Booking::query()->sole();
    expect($booking->status)->toBe(Booking::CONFIRMED)
        ->and($booking->customer_user_id)->toBe($customer->id)
        ->and($booking->hold_id)->toBe($hold->id)
        ->and($booking->confirmed_at)->not->toBeNull()
        ->and($booking->pending_expires_at)->toBeNull()
        ->and($booking->service_id)->toBe($shop->records->service->id)
        ->and($booking->service_name)->toBe('Full wash')
        ->and($booking->vehicle_type_name)->toBe('Sedan')
        ->and($booking->service_vehicle_variant_id)->toBe($shop->records->variant->id)
        ->and($booking->variant_price_centavos)->toBe(35000)
        ->and($booking->variant_duration_minutes)->toBe(60)
        ->and($booking->buffer_minutes)->toBe(10)
        ->and($booking->add_ons_price_centavos)->toBe(15000)
        ->and($booking->add_ons_duration_minutes)->toBe(20)
        ->and($booking->total_price_centavos)->toBe(50000)
        ->and($booking->resource_type_id)->toBe($shop->records->type->id)
        ->and($booking->resource_type_name)->toBe('Wash bay')
        ->and($booking->consumption_units)->toBe(1)
        ->and($booking->physical_resource_id)->toBe($shop->records->resource->id)
        ->and($booking->scheduled_start_at->equalTo(Shop::at('2026-10-06 10:00')))->toBeTrue()
        ->and($booking->service_end_at->equalTo(Shop::at('2026-10-06 11:20')))->toBeTrue()
        ->and($booking->occupied_end_at->equalTo(Shop::at('2026-10-06 11:30')))->toBeTrue()
        ->and($booking->branch_timezone)->toBe('Asia/Manila')
        ->and($booking->approval_mode)->toBe('auto_confirm')
        ->and($booking->policy_snapshot)->toEqual(['slot_interval_minutes' => 15, 'min_notice_minutes' => 60, 'horizon_days' => 30, 'approval_window_minutes' => 120])
        ->and($booking->contact_name)->toBe('Ana Cruz')
        ->and($booking->contact_email)->toBe($customer->email)
        ->and($booking->contact_phone)->toBe('+63 912 345 6789')
        ->and($booking->vehicle_make_model)->toBe('Toyota Vios')
        ->and($booking->vehicle_plate)->toBe('ABC 123')
        ->and($booking->customer_notes)->toBe('Please rinse the wheels.');

    $line = BookingAddOn::query()->sole();
    expect($line->booking_id)->toBe($booking->id)->and($line->name)->toBe('Wax')->and($line->price_centavos)->toBe(15000)->and($line->duration_minutes)->toBe(20);
    expect($hold->fresh()->status)->toBe(Hold::CONVERTED);
});

test('confirming redirects to the durable booking page', function () {
    [$shop, $hold] = readyToConfirm();

    $response = Journey::confirm($shop, $hold);
    $booking = Booking::query()->sole();

    $response->assertRedirect(route('bookings.show', ['shine', $booking->public_id]));
});

test('staff approval creates a pending request held until the least of the window and the start', function () {
    $shop = Shop::make()->policy(['approval_mode' => 'staff_approval', 'approval_window_minutes' => 120]);
    [, $hold] = readyToConfirm(shop: $shop, start: '2026-10-06 10:00');

    Journey::confirm($shop, $hold);

    $booking = Booking::query()->sole();
    expect($booking->status)->toBe(Booking::PENDING_APPROVAL)
        ->and($booking->approval_mode)->toBe('staff_approval')
        ->and($booking->confirmed_at)->toBeNull()
        ->and($booking->pending_expires_at->equalTo(now()->addMinutes(120)))->toBeTrue();
});

test('a pending request never outlasts the appointment start', function () {
    $shop = Shop::make()->policy(['approval_mode' => 'staff_approval', 'approval_window_minutes' => 1440, 'min_notice_minutes' => 0]);
    [, $hold] = readyToConfirm(shop: $shop, start: '2026-10-05 09:00');

    Journey::confirm($shop, $hold);

    expect(Booking::query()->sole()->pending_expires_at->equalTo(Shop::at('2026-10-05 09:00')))->toBeTrue();
});

test('the policy and prices in force at confirmation are preserved when they change later', function () {
    $shop = Shop::make();
    [, $hold] = readyToConfirm(shop: $shop);
    Journey::confirm($shop, $hold);
    $before = Booking::query()->sole()->getAttributes();

    $shop->policy(['approval_mode' => 'staff_approval', 'slot_interval_minutes' => 30, 'min_notice_minutes' => 240]);
    $shop->records->variant->forceFill(['price_centavos' => 99900, 'duration_minutes' => 90, 'buffer_minutes' => 30])->save();
    $shop->records->service->forceFill(['name' => 'Renamed'])->save();

    $after = Booking::query()->sole()->getAttributes();
    expect($after)->toEqual($before);
});

test('confirming twice returns the same booking and creates one row and one email', function () {
    [$shop, $hold] = readyToConfirm();

    $first = Journey::confirm($shop, $hold);
    $second = Journey::confirm($shop, $hold);

    expect(Booking::query()->count())->toBe(1);
    $first->assertRedirect(route('bookings.show', ['shine', Booking::query()->sole()->public_id]));
    $second->assertRedirect($first->headers->get('Location'));
    Mail::assertQueued(BookingConfirmedMail::class, 1);
});

test('the details step of a converted hold continues at its booking', function () {
    [$shop, $hold] = readyToConfirm();
    Journey::confirm($shop, $hold);

    $this->get(route('bookings.holds.details', ['shine', $hold->public_id]))
        ->assertRedirect(route('bookings.show', ['shine', Booking::query()->sole()->public_id]));
});

test('confirming without saved details sends the customer back to Details', function () {
    $shop = Shop::make();
    $this->actingAs(Tenant::user('c@example.test'));
    $hold = Journey::hold($shop);

    Journey::confirm($shop, $hold)->assertRedirect(route('bookings.holds.details', ['shine', $hold->public_id]));
    expect(Booking::query()->count())->toBe(0);
});

test('an expired hold is re-acquired when the time is still free', function () {
    [$shop, $hold] = readyToConfirm();
    $this->travel(20)->minutes();

    Journey::confirm($shop, $hold)->assertSessionHasNoErrors();

    expect(Booking::query()->sole()->status)->toBe(Booking::CONFIRMED)
        ->and($hold->fresh()->status)->toBe(Hold::CONVERTED);
});

test('an expired hold is rejected once somebody else has taken the time, and the selection is kept', function () {
    $shop = Shop::make(capacity: 1);
    [, $hold] = readyToConfirm(shop: $shop);
    $this->travel(20)->minutes();

    // A different customer takes the freed time.
    $mine = session()->all();
    $this->flushSession();
    [, $other] = readyToConfirm(shop: $shop);
    Journey::confirm($shop, $other)->assertSessionHasNoErrors();
    expect(Booking::query()->count())->toBe(1);

    $this->flushSession();
    $this->withSession($mine);
    $this->actingAs(Tenant::user('late@example.test'));
    Journey::confirm($shop, $hold)->assertSessionHasErrors(['start_at' => 'That time is no longer available. Choose another time.']);

    expect(Booking::query()->count())->toBe(1)->and($hold->fresh()->status)->not->toBe(Hold::CONVERTED);
});

test('a live hold excludes its own claim so the last unit can be confirmed', function () {
    [$shop, $hold] = readyToConfirm(['capacity' => 1]);

    Journey::confirm($shop, $hold)->assertSessionHasNoErrors();

    expect(Booking::query()->count())->toBe(1);
});

test('a deactivated held resource falls back to another feasible one', function () {
    $shop = Shop::make(capacity: 1);
    $spare = $shop->resource('Bay 2', 1);
    [, $hold] = readyToConfirm(shop: $shop);
    expect($hold->physical_resource_id)->toBe($shop->records->resource->id);

    $shop->records->resource->forceFill(['is_active' => false])->save();
    Journey::confirm($shop, $hold)->assertSessionHasNoErrors();

    expect(Booking::query()->sole()->physical_resource_id)->toBe($spare->id);
});

test('a held time that stopped being offered is refused at confirmation', function () {
    [$shop, $hold] = readyToConfirm();
    $shop->records->variant->forceFill(['is_active' => false])->save();

    // Unready shop (no available variant left): same generic 404 as everywhere.
    Journey::confirm($shop, $hold)->assertNotFound();
    expect(Booking::query()->count())->toBe(0);
});

test('minimum notice does not retroactively invalidate a time the customer legitimately holds', function () {
    $shop = Shop::make(); // 60 minutes of notice, now 08:00: 09:00 is the earliest start
    [, $hold] = readyToConfirm(shop: $shop, start: '2026-10-05 09:00');
    $this->travel(10)->minutes(); // now 08:10 would breach the notice, but the hold is still live

    Journey::confirm($shop, $hold)->assertSessionHasNoErrors();

    expect(Booking::query()->count())->toBe(1);
});

test('a still-live hold cannot be confirmed once its start has passed, in either approval mode', function (string $mode) {
    $shop = Shop::make()->policy(['approval_mode' => $mode, 'min_notice_minutes' => 0]);
    $this->travel(50)->minutes(); // 08:50
    [, $hold] = readyToConfirm(shop: $shop, start: '2026-10-05 09:00');
    $this->travel(11)->minutes(); // 09:01: the hold (15 minute TTL) is live, the start is not

    expect($hold->fresh()->isLive())->toBeTrue();
    Journey::confirm($shop, $hold)->assertSessionHasErrors('start_at');

    expect(Booking::query()->count())->toBe(0)->and($hold->fresh()->status)->toBe(Hold::ACTIVE);
    Mail::assertNothingQueued();
})->with(['auto_confirm', 'staff_approval']);

test('the database rejects rewriting snapshot columns and the add-on lines', function () {
    $shop = Shop::make();
    $wax = $shop->addOn();
    [, $hold] = readyToConfirm(shop: $shop, addOnIds: [$wax->id]);
    Journey::confirm($shop, $hold);
    $booking = Booking::query()->sole();

    foreach (['total_price_centavos' => 1, 'service_name' => 'x', 'scheduled_start_at' => now(), 'contact_email' => 'x@example.test', 'approval_mode' => 'staff_approval', 'consumption_units' => 2, 'vehicle_make_model' => 'Other'] as $column => $value) {
        expect(fn () => DB::transaction(fn () => DB::table('bookings')->where('id', $booking->id)->update([$column => $value])))
            ->toThrow(QueryException::class);
    }
    expect(fn () => DB::transaction(fn () => DB::table('booking_add_ons')->update(['name' => 'x'])))->toThrow(QueryException::class)
        ->and(fn () => DB::transaction(fn () => DB::table('booking_add_ons')->delete()))->toThrow(QueryException::class);

    // Operational state stays mutable.
    DB::table('bookings')->where('id', $booking->id)->update(['status' => Booking::EXPIRED, 'expired_at' => now(), 'reminder_sent_at' => now()]);
    expect($booking->fresh()->status)->toBe(Booking::EXPIRED);
});

test('the database enforces booking arithmetic', function () {
    $shop = Shop::make();
    [, $hold] = readyToConfirm(shop: $shop);
    Journey::confirm($shop, $hold);
    $existing = Booking::query()->sole();

    $row = $existing->getAttributes();
    unset($row['id']);
    $row['public_id'] = (string) Str::uuid();
    $row['hold_id'] = $shop->hold('2026-10-06 14:00', attributes: ['status' => Hold::CONVERTED])->id;

    $bad = array_merge($row, ['total_price_centavos' => 1]);
    expect(fn () => DB::transaction(fn () => DB::table('bookings')->insert($bad)))->toThrow(QueryException::class);
    $bad = array_merge($row, ['status' => 'pending_approval', 'pending_expires_at' => null]);
    expect(fn () => DB::transaction(fn () => DB::table('bookings')->insert($bad)))->toThrow(QueryException::class);
    $bad = array_merge($row, ['status' => 'teleported']);
    expect(fn () => DB::transaction(fn () => DB::table('bookings')->insert($bad)))->toThrow(QueryException::class);
    // A booking cannot reference another tenant's parents.
    $other = Shop::make('other');
    $bad = array_merge($row, ['service_id' => $other->records->service->id]);
    expect(fn () => DB::transaction(fn () => DB::table('bookings')->insert($bad)))->toThrow(QueryException::class);
});

test('bookings.hold_id is unique so a second booking per hold is impossible', function () {
    [$shop, $hold] = readyToConfirm();
    Journey::confirm($shop, $hold);
    $row = Booking::query()->sole()->getAttributes();
    unset($row['id']);
    $row['public_id'] = (string) Str::uuid();

    expect(fn () => DB::transaction(fn () => DB::table('bookings')->insert($row)))->toThrow(QueryException::class);
});

test('confirmation email is queued after commit for instant confirmation and for requests', function () {
    [$shop, $hold, $customer] = readyToConfirm();
    Journey::confirm($shop, $hold);
    Mail::assertQueued(BookingConfirmedMail::class, fn ($mail) => $mail->hasTo($customer->email) && $mail->bookingId === Booking::query()->sole()->id);
    Mail::assertNotQueued(BookingRequestReceivedMail::class);

    $pendingShop = Shop::make('pending')->policy(['approval_mode' => 'staff_approval']);
    [, $pendingHold] = readyToConfirm(shop: $pendingShop);
    Journey::confirm($pendingShop, $pendingHold);
    Mail::assertQueued(BookingRequestReceivedMail::class, 1);
});

test('nothing is queued when the transaction rolls back', function () {
    try {
        DB::transaction(function () {
            BookingNotifier::queue('a@example.test', new BookingConfirmedMail(1));

            throw new RuntimeException('rollback');
        });
    } catch (RuntimeException) {
    }

    Mail::assertNothingQueued();
});

test('a mail failure never undoes or fails a booking', function () {
    [$shop, $hold] = readyToConfirm();
    Mail::shouldReceive('to')->andThrow(new RuntimeException('mail provider down'));

    $response = Journey::confirm($shop, $hold);

    $booking = Booking::query()->sole();
    $response->assertRedirect(route('bookings.show', ['shine', $booking->public_id]));
    expect($booking->status)->toBe(Booking::CONFIRMED);
});

test('confirm locks the organization before it reads occupancy and before it inserts', function () {
    [$shop, $hold] = readyToConfirm();
    $statements = [];
    DB::listen(function ($query) use (&$statements) {
        $statements[] = strtolower($query->sql);
    });

    Journey::confirm($shop, $hold);

    $find = fn (callable $match) => collect($statements)->search($match);
    $lock = $find(fn ($sql) => str_contains($sql, 'from "organizations"') && str_contains($sql, 'for update'));
    $holdLock = $find(fn ($sql) => str_contains($sql, 'from "booking_holds"') && str_contains($sql, 'for update'));
    $occupancy = $find(fn ($sql) => str_contains($sql, 'from "bookings"') && str_contains($sql, '"physical_resource_id" in'));
    $insert = $find(fn ($sql) => str_starts_with($sql, 'insert into "bookings"'));

    expect($lock)->not->toBeFalse()
        ->and($lock)->toBeLessThan($holdLock)
        ->and($holdLock)->toBeLessThan($occupancy)
        ->and($occupancy)->toBeLessThan($insert);
});

test('placing a hold locks the organization before it reads occupancy and before it inserts', function () {
    $shop = Shop::make();
    $statements = [];
    DB::listen(function ($query) use (&$statements) {
        $statements[] = strtolower($query->sql);
    });

    Journey::placeHold($shop);

    $lock = collect($statements)->search(fn ($sql) => str_contains($sql, 'from "organizations"') && str_contains($sql, 'for update'));
    $occupancy = collect($statements)->search(fn ($sql) => str_contains($sql, 'from "booking_holds"') && str_contains($sql, '"physical_resource_id" in'));
    $insert = collect($statements)->search(fn ($sql) => str_starts_with($sql, 'insert into "booking_holds"'));

    expect($lock)->not->toBeFalse()->and($lock)->toBeLessThan($occupancy)->and($occupancy)->toBeLessThan($insert);
});

test('only the booking customer can open the booking page, inside its own shop', function () {
    [$shop, $hold, $customer] = readyToConfirm();
    Journey::confirm($shop, $hold);
    $booking = Booking::query()->sole();
    $url = route('bookings.show', ['shine', $booking->public_id]);

    $this->withoutVite()->get($url)->assertOk()->assertInertia(fn (Assert $page) => $page
        ->component('shops/bookings/show')
        ->where('booking.status', 'confirmed')
        ->where('booking.serviceName', 'Full wash')
        ->where('booking.totalCentavos', 35000)
        ->where('booking.timezone', 'Asia/Manila')
        ->where('booking.vehicleMakeModel', 'Toyota Vios')
        ->missing('booking.bufferMinutes')
        ->where('booking.contactEmail', $customer->email));

    $other = Shop::make('other');
    $this->get(route('bookings.show', ['other', $booking->public_id]))->assertNotFound();

    $this->actingAs(Tenant::user('stranger@example.test'));
    $this->get($url)->assertNotFound();

    auth()->logout();
    $this->get($url)->assertNotFound();
});

test('the confirm page is only for a signed-in customer with details and carries no internals', function () {
    [$shop, $hold] = readyToConfirm();

    $response = $this->withoutVite()->get(route('bookings.holds.confirm.show', ['shine', $hold->public_id]))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('shops/book/confirm')->where('contact.name', 'Ana Cruz')->where('contact.makeModel', 'Toyota Vios')->where('requestOnly', false)->missing('summary.bufferMinutes'));

    expect(Journey::leaksInternals($response->original->getData()['page']['props']))->toBeFalse();
});

test('confirming is throttled per IP', function () {
    config(['rinquo.booking.confirm_per_ip' => 1]);
    [$shop, $hold] = readyToConfirm();

    Journey::confirm($shop, $hold)->assertRedirect();
    Journey::confirm($shop, $hold)->assertStatus(429);
    expect(Booking::query()->count())->toBe(1);
});

test('a hold without a make and model cannot be confirmed and sends the customer back to Details', function () {
    $shop = Shop::make();
    $customer = Tenant::user('legacy@example.test');
    $this->actingAs($customer);
    $hold = Journey::hold($shop);
    $hold->forceFill(['vehicle_make_model' => null])->save();
    Journey::saveDetails($shop, $hold, ['vehicle_make_model' => ''])->assertSessionHasErrors('vehicle_make_model');
    $hold->forceFill(['contact_name' => 'Ana Cruz'])->save();

    Journey::confirm($shop, $hold)->assertRedirect(route('bookings.holds.details', ['shine', $hold->public_id]))->assertSessionHasErrors('vehicle_make_model');

    expect(Booking::query()->count())->toBe(0)->and($hold->fresh()->status)->toBe(Hold::ACTIVE);
});

test('confirming keeps the vehicle for the verified customer once, without touching the booking snapshot', function () {
    [$shop, $hold, $customer] = readyToConfirm();

    Journey::confirm($shop, $hold)->assertSessionHasNoErrors();
    Journey::confirm($shop, $hold)->assertSessionHasNoErrors();

    $vehicle = CustomerVehicle::query()->where('user_id', $customer->id)->sole();
    expect($vehicle->make_model)->toBe('Toyota Vios')->and($vehicle->plate)->toBe('ABC 123');

    $vehicle->forceFill(['make_model' => 'Renamed', 'archived_at' => now()])->save();
    expect(Booking::query()->sole()->vehicle_make_model)->toBe('Toyota Vios');
});

test('a plateless vehicle is saved once per customer and never as another customer\'s', function () {
    $shop = Shop::make();
    $customer = Tenant::user('plateless@example.test');
    $this->actingAs($customer);
    $hold = Journey::hold($shop);
    Journey::saveDetails($shop, $hold, ['vehicle_plate' => ''])->assertSessionHasNoErrors();

    Journey::confirm($shop, $hold)->assertSessionHasNoErrors();

    expect(CustomerVehicle::query()->count())->toBe(1)
        ->and(CustomerVehicle::query()->sole()->plate)->toBeNull()
        ->and(CustomerVehicle::query()->sole()->user_id)->toBe($customer->id);
});

test('the confirm page tells the customer when the shop approves each booking first', function () {
    $shop = Shop::make()->policy(['approval_mode' => 'staff_approval', 'approval_window_minutes' => 120]);
    [, $hold] = readyToConfirm(shop: $shop);

    $this->withoutVite()->get(route('bookings.holds.confirm.show', ['shine', $hold->public_id]))
        ->assertInertia(fn (Assert $page) => $page->where('requestOnly', true));
});
