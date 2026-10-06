<?php

namespace Tests\Support;

use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Subscription\PayMongo\PayMongoGateway;
use App\Modules\Subscription\PayMongo\WebhookSignature;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Testing\TestResponse;

/** Helpers for subscription tests: a fake provider, entitlement instants and signed webhook bodies. */
final class Billing
{
    public const SECRET = 'whsec_test_secret';

    public static function fake(): FakePayMongoGateway
    {
        config(['services.paymongo.webhook_secret' => self::SECRET, 'services.paymongo.secret_key' => 'sk_test_fake', 'services.paymongo.mode' => 'test']);
        $gateway = new FakePayMongoGateway;
        app()->instance(PayMongoGateway::class, $gateway);

        return $gateway;
    }

    /** Sets the entitlement instants directly (UTC). */
    public static function set(Organization $organization, CarbonImmutable $trialEnds, ?CarbonImmutable $paidUntil, CarbonImmutable $graceEnds): Subscription
    {
        $subscription = Subscription::query()->where('organization_id', $organization->id)->firstOrFail();
        $subscription->forceFill(['trial_ends_at' => $trialEnds, 'paid_until' => $paidUntil, 'grace_ends_at' => $graceEnds])->save();

        return $subscription->fresh();
    }

    /** The trial and grace both ended: restricted from the given instant on. */
    public static function restrict(Organization $organization, ?CarbonImmutable $graceEnds = null): Subscription
    {
        $graceEnds ??= CarbonImmutable::now()->subMinute();

        return self::set($organization, $graceEnds->subDays(7), null, $graceEnds);
    }

    /** @return array<string, mixed> */
    public static function paidEvent(PaymentRequest $request, array $overrides = []): array
    {
        $paidAt = $overrides['paid_at'] ?? CarbonImmutable::now()->timestamp;

        return [
            'data' => [
                'id' => $overrides['event_id'] ?? 'evt_'.bin2hex(random_bytes(6)),
                'type' => 'event',
                'attributes' => [
                    'type' => $overrides['type'] ?? 'payment.paid',
                    'livemode' => $overrides['livemode'] ?? false,
                    'data' => [
                        'id' => $overrides['payment_id'] ?? 'pay_'.$request->public_id,
                        'type' => 'payment',
                        'attributes' => [
                            'status' => $overrides['status'] ?? 'paid',
                            'amount' => $overrides['amount'] ?? $request->amount_centavos,
                            'currency' => $overrides['currency'] ?? $request->currency,
                            'paid_at' => $paidAt,
                            'payment_intent_id' => $overrides['intent'] ?? $request->provider_payment_intent_id,
                        ],
                    ],
                ],
            ],
        ];
    }

    /** Posts the exact raw body with a correct signature unless overridden. */
    public static function deliver(array|string $payload, ?string $signature = null, ?int $timestamp = null): TestResponse
    {
        $raw = is_string($payload) ? $payload : json_encode($payload, JSON_UNESCAPED_SLASHES);
        $header = $signature ?? WebhookSignature::header($raw, self::SECRET, 'test', $timestamp);

        return test()->call('POST', route('webhooks.paymongo'), [], [], [], [
            'CONTENT_TYPE' => 'application/json', 'HTTP_ACCEPT' => 'application/json', 'HTTP_PAYMONGO_SIGNATURE' => $header,
        ], $raw);
    }
}
