<?php

use App\Modules\Subscription\Models\Payment;
use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Subscription\Models\WebhookEvent;
use App\Modules\Tenancy\Actions\RequestClosure;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Mail;
use Tests\Support\Billing;
use Tests\Support\Tenant;

beforeEach(function () {
    config(['rinquo.subscription.grace_days' => 3, 'rinquo.subscription.amount_centavos' => 99900]);
    Mail::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Manila'));
    $this->gateway = Billing::fake();
    [$this->owner, $this->organization] = Tenant::organization();
    // Access ends in 5 days: inside the 7-day renewal window.
    $this->endsAt = now()->addDays(5)->setMicroseconds(0);
    Billing::set($this->organization, $this->endsAt, null, $this->endsAt->addDays(3));
});

function regenerate(): void
{
    test()->artisan('subscriptions:regenerate-requests')->assertSuccessful();
}

function requests(): int
{
    return PaymentRequest::query()->count();
}

test('a request is created inside the window with a 24 hour life and an intent but no QR', function () {
    regenerate();

    $request = PaymentRequest::query()->sole();
    expect($request->status)->toBe(PaymentRequest::OPEN)
        ->and($request->expires_at->equalTo(now()->addHours(24)))->toBeTrue()
        ->and($request->provider_payment_intent_id)->toStartWith('pi_')
        ->and($request->qr_image)->toBeNull()
        ->and($this->gateway->count('intent'))->toBe(1)
        ->and($this->gateway->count('attach'))->toBe(0);
});

test('an expired request is replaced exactly once, and reruns are idempotent', function () {
    regenerate();
    $first = PaymentRequest::query()->sole();

    regenerate();
    expect(requests())->toBe(1);

    $this->travelTo($first->expires_at->addMinute());
    regenerate();
    regenerate();

    expect(requests())->toBe(2)
        ->and($first->fresh()->status)->toBe(PaymentRequest::EXPIRED)
        ->and(PaymentRequest::query()->where('status', PaymentRequest::OPEN)->count())->toBe(1)
        ->and($this->gateway->count('intent'))->toBe(2);
});

test('QR expiry alone does not regenerate an open request', function () {
    $this->actingAs($this->owner)->post(route('owner.settings.billing.renewal', $this->organization))->assertSessionHasNoErrors();
    $request = PaymentRequest::query()->sole();

    $this->travelTo($request->qr_expires_at->addMinute());
    regenerate();

    expect(requests())->toBe(1)->and($this->gateway->count('intent'))->toBe(1);
});

test('the owner button and the scheduler converge on one open request', function () {
    regenerate();
    $this->actingAs($this->owner)->post(route('owner.settings.billing.renewal', $this->organization))->assertSessionHasNoErrors();
    regenerate();

    expect(requests())->toBe(1)->and($this->gateway->count('intent'))->toBe(1)->and(PaymentRequest::query()->sole()->qr_image)->not->toBeNull();
});

test('nothing is created before the window, after an unpaid trial ends, after paid grace, or for a closed organization', function () {
    $this->travelTo($this->endsAt->subDays(8));
    regenerate();
    expect(requests())->toBe(0);

    $this->travelTo($this->endsAt);
    regenerate();
    expect(requests())->toBe(0);

    Billing::set($this->organization, $this->endsAt->subDays(40), $this->endsAt, $this->endsAt->addDays(3));
    $this->travelTo($this->endsAt->addDays(3));
    regenerate();
    expect(requests())->toBe(0);

    $this->travelTo($this->endsAt->subDays(2));
    app(RequestClosure::class)->handle($this->organization, $this->owner, $this->organization->name);
    regenerate();

    expect(requests())->toBe(0)->and($this->gateway->calls)->toBe([]);
});

test('a paid organization inside grace still gets a request until grace ends', function () {
    $paidUntil = now()->addDay()->setMicroseconds(0);
    Billing::set($this->organization, now()->subDays(40), $paidUntil, $paidUntil->addDays(3));

    $this->travelTo($paidUntil->addDays(2));
    regenerate();

    expect(requests())->toBe(1);
});

test('an early payment closes the window by itself', function () {
    Billing::set($this->organization, now()->subDays(40), $this->endsAt->addMonth(), $this->endsAt->addMonth()->addDays(3));
    regenerate();

    expect(requests())->toBe(0);
});

test('an unprocessed paid receipt for the old intent blocks regeneration', function () {
    regenerate();
    $first = PaymentRequest::query()->sole();
    (new WebhookEvent)->forceFill([
        'provider_event_id' => 'evt_pending', 'event_type' => 'payment.paid', 'livemode' => false, 'status' => WebhookEvent::RECEIVED,
        'provider_payment_intent_id' => $first->provider_payment_intent_id, 'provider_payment_id' => 'pay_x', 'amount_centavos' => 99900, 'currency' => 'PHP',
        'paid_at' => $first->expires_at->subMinute(), 'received_at' => now(),
    ])->save();

    $this->travelTo($first->expires_at->addMinute());
    regenerate();

    expect(requests())->toBe(1);
});

test('a late payment on the expired request after regeneration extends exactly once and closes the new request', function () {
    regenerate();
    $first = PaymentRequest::query()->sole();
    $this->travelTo($first->expires_at->addMinute());
    regenerate();
    $second = PaymentRequest::query()->where('status', PaymentRequest::OPEN)->sole();

    Billing::deliver(Billing::paidEvent($first, ['paid_at' => $first->expires_at->subMinute()->timestamp]))->assertOk();
    Billing::deliver(Billing::paidEvent($first, ['paid_at' => $first->expires_at->subMinute()->timestamp]))->assertOk();

    expect(Payment::query()->count())->toBe(1)
        ->and($first->fresh()->status)->toBe(PaymentRequest::PAID)
        ->and($second->fresh()->status)->toBe(PaymentRequest::EXPIRED)
        ->and(PaymentRequest::query()->where('status', PaymentRequest::OPEN)->count())->toBe(0)
        ->and(Subscription::query()->sole()->paid_until)->not->toBeNull();
});

test('a provider failure is backed off, makes no calls inside the backoff and recovers afterwards', function () {
    $this->gateway->failing = true;
    regenerate();
    $request = PaymentRequest::query()->sole();

    expect($request->provider_payment_intent_id)->toBeNull()
        ->and($request->provider_attempts)->toBe(1)
        ->and($request->last_provider_error)->toBe('provider_unavailable')
        ->and($request->next_provider_attempt_at->equalTo(now()->addMinutes(15)))->toBeTrue();

    $this->travel(10)->minutes();
    regenerate();
    expect($request->fresh()->provider_attempts)->toBe(1);

    $this->travel(6)->minutes();
    regenerate();
    expect($request->fresh()->provider_attempts)->toBe(2)
        ->and($request->fresh()->next_provider_attempt_at->equalTo(now()->addMinutes(30)))->toBeTrue();

    $this->gateway->failing = false;
    $this->travel(31)->minutes();
    regenerate();

    $request = $request->fresh();
    expect($request->provider_payment_intent_id)->toStartWith('pi_')
        ->and($request->provider_attempts)->toBe(0)->and($request->next_provider_attempt_at)->toBeNull()->and($request->last_provider_error)->toBeNull()
        ->and(requests())->toBe(1)
        ->and(Subscription::query()->sole()->paid_until)->toBeNull();
});

test('a provider outage stops the run after five consecutive failures and never changes entitlement', function () {
    foreach (range(1, 7) as $i) {
        [, $organization] = Tenant::organization("outage-{$i}");
        Billing::set($organization, $this->endsAt, null, $this->endsAt->addDays(3));
    }
    $this->gateway->failing = true;

    regenerate();

    expect(PaymentRequest::query()->whereNotNull('last_provider_error')->count())->toBe(5)
        ->and(Subscription::query()->whereNotNull('paid_until')->count())->toBe(0);
});

test('an unconfigured provider makes no request and no call', function () {
    $this->gateway->configured = false;
    regenerate();

    expect(requests())->toBe(0)->and($this->gateway->calls)->toBe([]);
});

test('the command is scheduled every ten minutes without overlap', function () {
    $event = collect(app(Schedule::class)->events())->first(fn ($e) => str_contains($e->command, 'subscriptions:regenerate-requests'));

    expect($event)->not->toBeNull()->and($event->expression)->toBe('*/10 * * * *')->and($event->withoutOverlapping)->toBeTrue();
});
