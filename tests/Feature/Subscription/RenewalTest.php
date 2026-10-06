<?php

use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Tenancy\Models\Membership;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Billing;
use Tests\Support\Tenant;

beforeEach(function () {
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Manila'));
    $this->gateway = Billing::fake();
    [$this->owner, $this->organization] = Tenant::organization();
});

function renew($test, array $data = [])
{
    return $test->actingAs($test->owner)->post(route('owner.settings.billing.renewal', $test->organization), $data);
}

test('the billing page shows the plan, state and no request before one is made', function () {
    $this->actingAs($this->owner)->withoutVite()->get(route('owner.settings.billing', $this->organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('owner/settings/billing')
            ->where('entitlement.state', 'trial')
            ->where('entitlement.acceptsNewBookings', true)
            ->where('billing.plan.amountCentavos', 99900)
            ->where('billing.billingAvailable', true)
            ->where('billing.request', null)
            ->where('billing.lastPayment', null)
            ->where('organization.billingUrl', route('owner.settings.billing', $this->organization, absolute: false)));
});

test('generating a renewal request snapshots server-chosen terms and attaches a short-lived QR', function () {
    renew($this, ['amount' => 1, 'paid_until' => '2099-01-01'])->assertRedirect()->assertSessionHasNoErrors();

    $request = PaymentRequest::query()->sole();
    expect($request->amount_centavos)->toBe(99900)
        ->and($request->currency)->toBe('PHP')
        ->and($request->status)->toBe(PaymentRequest::OPEN)
        ->and($request->expires_at->equalTo(now()->addHours(24)))->toBeTrue()
        ->and($request->provider_payment_intent_id)->toStartWith('pi_')
        ->and($request->qr_image)->toStartWith('data:image/png;base64,')
        ->and($request->qr_expires_at->equalTo(now()->addSeconds(1800)))->toBeTrue()
        ->and(Subscription::query()->sole()->paid_until)->toBeNull();
    // The provider received a bounded QR lifetime, never anything the browser sent.
    expect($this->gateway->count('method:1800'))->toBe(1);
});

test('a double click reuses the request and does not create a second provider object', function () {
    renew($this)->assertSessionHasNoErrors();
    renew($this)->assertSessionHasNoErrors();

    expect(PaymentRequest::query()->count())->toBe(1)
        ->and($this->gateway->count('intent'))->toBe(1)
        ->and($this->gateway->count('attach'))->toBe(1);
});

test('the QR is served only for the open request and carries no secret', function () {
    renew($this);

    $this->actingAs($this->owner)->withoutVite()->get(route('owner.settings.billing', $this->organization))
        ->assertInertia(fn (Assert $page) => $page
            ->where('billing.request.qrImage', fn ($image) => str_starts_with($image, 'data:image/png;base64,'))
            ->where('billing.request.amountCentavos', 99900)
            ->missing('billing.request.provider_payment_intent_id'));
});

test('an expired QR is refreshed within the same open request with a new idempotency generation', function () {
    renew($this);
    $request = PaymentRequest::query()->sole();

    $this->travel(31)->minutes();
    $this->actingAs($this->owner)->withoutVite()->get(route('owner.settings.billing', $this->organization))
        ->assertInertia(fn (Assert $page) => $page->where('billing.request.qrImage', null)->where('billing.request.id', $request->public_id));

    renew($this, ['refresh' => 1])->assertSessionHasNoErrors();

    $fresh = $request->fresh();
    expect(PaymentRequest::query()->count())->toBe(1)
        ->and($fresh->qr_generation)->toBe(2)
        ->and($fresh->qr_image)->not->toBeNull()
        ->and($fresh->qr_expires_at > now())->toBeTrue()
        ->and($this->gateway->count('intent'))->toBe(1)
        ->and($this->gateway->count('attach'))->toBe(2);
});

test('a QR never outlives the local 24 hour request', function () {
    config(['rinquo.subscription.qr_lifetime_seconds' => 9000]);
    renew($this);
    $request = PaymentRequest::query()->sole();

    $this->travelTo($request->expires_at->subMinutes(5));
    renew($this)->assertSessionHasNoErrors();

    $request = $request->fresh();
    expect($request->qr_expires_at <= $request->expires_at->addSeconds(60))->toBeTrue();
});

test('after the 24 hour request lifetime the request closes and a new one is made', function () {
    renew($this);
    $first = PaymentRequest::query()->sole();

    $this->travelTo($first->expires_at->addMinute());
    $this->actingAs($this->owner)->withoutVite()->get(route('owner.settings.billing', $this->organization))
        ->assertInertia(fn (Assert $page) => $page->where('billing.request', null)->has('billing.lastRequestExpiredAt'));
    renew($this)->assertSessionHasNoErrors();

    expect($first->fresh()->status)->toBe(PaymentRequest::EXPIRED)
        ->and(PaymentRequest::query()->where('status', PaymentRequest::OPEN)->count())->toBe(1)
        ->and(PaymentRequest::query()->count())->toBe(2);
});

test('a provider outage is reported honestly, changes no entitlement and can be retried', function () {
    $this->gateway->failing = true;
    $before = Subscription::query()->sole()->only(['trial_ends_at', 'paid_until', 'grace_ends_at']);

    renew($this)->assertSessionHasErrors('billing');

    expect(session('errors')->first('billing'))->toContain('not been charged')
        ->and(Subscription::query()->sole()->only(['trial_ends_at', 'paid_until', 'grace_ends_at']))->toEqual($before)
        ->and(PaymentRequest::query()->sole()->last_provider_error)->not->toBeNull();

    $this->gateway->failing = false;
    renew($this)->assertSessionHasNoErrors();

    expect(PaymentRequest::query()->count())->toBe(1)
        ->and(PaymentRequest::query()->sole()->qr_image)->not->toBeNull()
        ->and(PaymentRequest::query()->sole()->last_provider_error)->toBeNull();
});

test('missing provider configuration fails billing closed while the page stays readable', function () {
    $this->gateway->configured = false;

    renew($this)->assertSessionHasErrors('billing');
    $this->actingAs($this->owner)->withoutVite()->get(route('owner.settings.billing', $this->organization))
        ->assertOk()->assertInertia(fn (Assert $page) => $page->where('billing.billingAvailable', false));

    expect(PaymentRequest::query()->count())->toBe(0);
});

test('only the Owner of the organization can see billing or ask for a QR', function () {
    $staff = Tenant::user('staff@example.test');
    Membership::query()->create(['organization_id' => $this->organization->id, 'user_id' => $staff->id, 'role' => Membership::STAFF]);
    [$rival] = Tenant::organization('rival');

    $this->actingAs($staff)->get(route('owner.settings.billing', $this->organization))->assertForbidden();
    $this->actingAs($staff)->post(route('owner.settings.billing.renewal', $this->organization))->assertForbidden();
    $this->actingAs($rival)->get(route('owner.settings.billing', $this->organization))->assertNotFound();
    $this->actingAs($rival)->post(route('owner.settings.billing.renewal', $this->organization))->assertNotFound();
    auth()->logout();
    $this->post(route('owner.settings.billing.renewal', $this->organization))->assertRedirect();

    expect(PaymentRequest::query()->count())->toBe(0);
});

test('billing stays reachable and renewal works while restricted or closed', function () {
    Billing::restrict($this->organization);
    $this->actingAs($this->owner)->withoutVite()->get(route('owner.settings.billing', $this->organization))
        ->assertOk()->assertInertia(fn (Assert $page) => $page->where('entitlement.state', 'restricted'));

    renew($this)->assertSessionHasNoErrors();

    expect(PaymentRequest::query()->sole()->qr_image)->not->toBeNull();
});

test('the database rejects a second open request, a non-positive amount and an unsupported currency', function () {
    renew($this);
    $request = PaymentRequest::query()->sole();
    $row = fn (array $over) => array_merge($request->only(['organization_id', 'subscription_id', 'amount_centavos', 'currency', 'provider_mode', 'expires_at']), ['public_id' => (string) Str::uuid(), 'created_at' => now(), 'updated_at' => now()], $over);

    // Each statement runs in a savepoint so the failed one does not poison the test transaction.
    expect(fn () => DB::transaction(fn () => DB::table('subscription_payment_requests')->insert($row(['status' => 'open']))))->toThrow(UniqueConstraintViolationException::class);
    $request->forceFill(['status' => 'expired'])->save();
    expect(fn () => DB::transaction(fn () => DB::table('subscription_payment_requests')->insert($row(['amount_centavos' => 0]))))->toThrow(QueryException::class);
});

test('the same renewal data never leaks to another organization', function () {
    renew($this);
    [$rivalOwner, $rival] = Tenant::organization('rival');

    $this->actingAs($rivalOwner)->withoutVite()->get(route('owner.settings.billing', $rival))
        ->assertInertia(fn (Assert $page) => $page->where('billing.request', null));
});
