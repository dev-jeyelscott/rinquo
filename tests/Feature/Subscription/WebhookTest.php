<?php

use App\Modules\Subscription\Actions\ApplyPaidPayment;
use App\Modules\Subscription\Mail\PaymentConfirmedMail;
use App\Modules\Subscription\Models\Payment;
use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Subscription\Models\WebhookEvent;
use App\Modules\Subscription\PayMongo\WebhookSignature;
use App\Modules\Tenancy\Models\AuditEvent;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Mail;
use Tests\Support\Billing;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Manila'));
    $this->gateway = Billing::fake();
    [$this->owner, $this->organization] = Tenant::organization();
    $this->request = openRequest($this);
});

function openRequest($test): PaymentRequest
{
    $test->actingAs($test->owner)->post(route('owner.settings.billing.renewal', $test->organization))->assertSessionHasNoErrors();

    return PaymentRequest::query()->where('organization_id', $test->organization->id)->where('status', PaymentRequest::OPEN)->sole();
}

function subscription(): Subscription
{
    return Subscription::query()->sole();
}

test('a valid signed paid event during the trial extends one month from trial end, once', function () {
    $trialEnds = subscription()->trial_ends_at;
    $event = Billing::paidEvent($this->request);

    Billing::deliver($event)->assertOk();

    $subscription = subscription();
    expect($subscription->paid_until->equalTo($trialEnds->setTimezone('Asia/Manila')->addMonthNoOverflow()->utc()))->toBeTrue()
        ->and($subscription->grace_ends_at->equalTo($subscription->paid_until->addDays(7)))->toBeTrue()
        ->and($this->request->fresh()->status)->toBe(PaymentRequest::PAID)
        ->and($this->request->fresh()->qr_image)->toBeNull()
        ->and(Payment::query()->count())->toBe(1)
        ->and(WebhookEvent::query()->sole()->status)->toBe(WebhookEvent::PROCESSED)
        ->and(AuditEvent::query()->where('action', 'subscription.payment_confirmed')->count())->toBe(1);
    Mail::assertQueued(PaymentConfirmedMail::class, 1);
});

test('replaying the same event and competing duplicates extend entitlement once', function () {
    $event = Billing::paidEvent($this->request);

    Billing::deliver($event)->assertOk();
    $once = subscription()->paid_until;
    Billing::deliver($event)->assertOk();
    // A different event id for the same provider payment must not extend either.
    Billing::deliver(Billing::paidEvent($this->request, ['payment_id' => 'pay_'.$this->request->public_id]))->assertOk();

    expect(subscription()->paid_until->equalTo($once))->toBeTrue()
        ->and(Payment::query()->count())->toBe(1);
    Mail::assertQueued(PaymentConfirmedMail::class, 1);
});

test('a job retried after the payment was recorded changes nothing', function () {
    Billing::deliver(Billing::paidEvent($this->request))->assertOk();
    $paidUntil = subscription()->paid_until;
    $event = WebhookEvent::query()->sole();

    // Simulate a lost acknowledgement: the receipt is re-queued as received.
    $event->forceFill(['status' => WebhookEvent::RECEIVED, 'processed_at' => null])->save();
    app(ApplyPaidPayment::class)->handle($event->id);

    expect(subscription()->paid_until->equalTo($paidUntil))->toBeTrue()
        ->and(Payment::query()->count())->toBe(1)
        ->and($event->fresh()->reason)->toBe('duplicate');
});

test('the database makes a second payment for one request or provider payment impossible', function () {
    Billing::deliver(Billing::paidEvent($this->request))->assertOk();
    $payment = Payment::query()->sole();

    expect(fn () => Payment::query()->forceCreate([...$payment->only(['organization_id', 'subscription_id', 'payment_request_id', 'provider_payment_intent_id', 'amount_centavos', 'currency', 'provider_mode']),
        'provider_payment_id' => 'pay_other', 'paid_at' => now(), 'period_starts_at' => now(), 'paid_until' => now()->addMonth(), 'grace_ends_at' => now()->addMonth()->addDay(), 'created_at' => now()]))
        ->toThrow(UniqueConstraintViolationException::class);
});

test('requests without a valid signature are refused and queue nothing', function (string $case) {
    $raw = json_encode(Billing::paidEvent($this->request));
    $signature = match ($case) {
        'missing' => null,
        'wrong secret' => WebhookSignature::header($raw, 'whsec_other', 'test'),
        'tampered body' => WebhookSignature::header($raw.' ', Billing::SECRET, 'test'),
        'live signature on test endpoint' => WebhookSignature::header($raw, Billing::SECRET, 'live'),
        'stale' => WebhookSignature::header($raw, Billing::SECRET, 'test', time() - 3600),
        'garbage' => 'nonsense',
    };
    $before = subscription()->paid_until;

    $response = $signature === null
        ? test()->call('POST', route('webhooks.paymongo'), [], [], [], ['CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json'], $raw)
        : Billing::deliver($raw, $signature);

    $response->assertStatus(400);
    expect(WebhookEvent::query()->count())->toBe(0)
        ->and(subscription()->paid_until)->toBe($before)
        ->and(Payment::query()->count())->toBe(0);
})->with(['missing', 'wrong secret', 'tampered body', 'live signature on test endpoint', 'stale', 'garbage']);

test('an unsigned screenshot-like request or browser claim never changes entitlement', function () {
    $this->actingAs($this->owner)->post(route('owner.settings.billing.renewal', $this->organization), ['paid' => true, 'paid_until' => '2030-01-01'])->assertRedirect();
    $this->post('/webhooks/paymongo', ['status' => 'paid'])->assertStatus(400);

    expect(subscription()->paid_until)->toBeNull()->and(Payment::query()->count())->toBe(0);
});

test('a wrong-mode, wrong-amount, wrong-currency or wrong-intent event is retained but never becomes access', function (array $override, string $reason) {
    Billing::deliver(Billing::paidEvent($this->request, $override))->assertOk();

    $event = WebhookEvent::query()->sole();
    expect($event->status)->toBe(WebhookEvent::REJECTED)->and($event->reason)->toBe($reason)
        ->and(subscription()->paid_until)->toBeNull()->and(Payment::query()->count())->toBe(0)
        ->and($this->request->fresh()->status)->toBe(PaymentRequest::OPEN);
})->with([
    'live event in test mode' => [['livemode' => true], 'mode_mismatch'],
    'wrong amount' => [['amount' => 100], 'amount_mismatch'],
    'wrong currency' => [['currency' => 'USD'], 'currency_mismatch'],
    'unknown intent' => [['intent' => 'pi_unknown'], 'unknown_intent'],
    'paid before the request existed' => [['paid_at' => 1_700_000_000], 'outside_payable_window'],
]);

test('a payment after the request and QR window closed is not honoured', function () {
    $late = $this->request->payableUntil()->addMinutes(10)->timestamp;

    Billing::deliver(Billing::paidEvent($this->request, ['paid_at' => $late]))->assertOk();

    expect(WebhookEvent::query()->sole()->reason)->toBe('outside_payable_window')->and(subscription()->paid_until)->toBeNull();
});

test('non-paid and out-of-order events are retained and cannot extend or revoke entitlement', function () {
    Billing::deliver(Billing::paidEvent($this->request))->assertOk();
    $paidUntil = subscription()->paid_until;

    Billing::deliver(Billing::paidEvent($this->request, ['type' => 'payment.failed', 'status' => 'failed']))->assertOk();
    Billing::deliver(Billing::paidEvent($this->request, ['type' => 'qrph.expired']))->assertOk();

    expect(WebhookEvent::query()->where('status', WebhookEvent::IGNORED)->count())->toBe(2)
        ->and(subscription()->paid_until->equalTo($paidUntil))->toBeTrue()
        ->and($this->request->fresh()->status)->toBe(PaymentRequest::PAID);
});

test('a failed event before the paid one does not block the later payment', function () {
    Billing::deliver(Billing::paidEvent($this->request, ['type' => 'payment.failed', 'status' => 'failed']))->assertOk();
    Billing::deliver(Billing::paidEvent($this->request))->assertOk();

    expect(subscription()->paid_until)->not->toBeNull()->and(Payment::query()->count())->toBe(1);
});

test('early renewal extends from the existing paid-through date and expired renewal starts at payment time', function () {
    Billing::deliver(Billing::paidEvent($this->request))->assertOk();
    $first = subscription()->paid_until;

    // Pay again before the first month ends: the second month follows the first.
    $second = openRequest($this);
    expect($second->id)->not->toBe($this->request->id);
    Billing::deliver(Billing::paidEvent($second))->assertOk();
    expect(subscription()->paid_until->equalTo($first->setTimezone('Asia/Manila')->addMonthNoOverflow()->utc()))->toBeTrue();

    // Let everything lapse, then pay: the month starts at the confirmed payment time.
    $this->travelTo(subscription()->grace_ends_at->addDays(3));
    $third = openRequest($this);
    $paidAt = CarbonImmutable::now();
    Billing::deliver(Billing::paidEvent($third, ['paid_at' => $paidAt->timestamp]))->assertOk();

    expect(subscription()->paid_until->equalTo($paidAt->setTimezone('Asia/Manila')->addMonthNoOverflow()->utc()))->toBeTrue()
        ->and(Payment::query()->count())->toBe(3);
});

test('a late paid event for a request that expired locally within its payable window still pays once', function () {
    $paidAt = $this->request->expires_at->subMinute();
    $this->travelTo($this->request->expires_at->addMinutes(2));
    $this->actingAs($this->owner)->get(route('owner.settings.billing', $this->organization))->assertOk();

    Billing::deliver(Billing::paidEvent($this->request, ['paid_at' => $paidAt->timestamp]))->assertOk();

    expect(Payment::query()->count())->toBe(1)->and(subscription()->paid_until)->not->toBeNull();
});

test('malformed or oversized signed bodies are refused', function () {
    Billing::deliver('not json')->assertStatus(422);
    Billing::deliver(['data' => ['id' => 'evt_x']])->assertStatus(422);
    Billing::deliver(str_repeat('a', 70_000))->assertStatus(413);

    expect(WebhookEvent::query()->count())->toBe(0);
});

test('payment evidence belongs to the organization that owns the request', function () {
    [, $other] = Tenant::organization('rival');
    $otherBefore = Subscription::query()->where('organization_id', $other->id)->sole()->paid_until;

    Billing::deliver(Billing::paidEvent($this->request))->assertOk();

    expect(Subscription::query()->where('organization_id', $other->id)->sole()->paid_until)->toBe($otherBefore)
        ->and(Payment::query()->sole()->organization_id)->toBe($this->organization->id);
});
