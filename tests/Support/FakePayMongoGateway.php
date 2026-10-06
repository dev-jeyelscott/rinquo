<?php

namespace Tests\Support;

use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\PayMongo\PayMongoException;
use App\Modules\Subscription\PayMongo\PayMongoGateway;

/** The outbound PayMongo boundary for tests: records calls, can be configured off or made to fail. Never talks to a network. */
final class FakePayMongoGateway implements PayMongoGateway
{
    /** @var list<array{string, string}> */
    public array $calls = [];

    public bool $configured = true;

    public bool $failing = false;

    private int $counter = 0;

    public function isConfigured(): bool
    {
        return $this->configured;
    }

    public function mode(): string
    {
        return 'test';
    }

    public function createPaymentIntent(PaymentRequest $request, string $idempotencyKey): string
    {
        return 'pi_'.$this->record('intent', $idempotencyKey);
    }

    public function createQrPaymentMethod(PaymentRequest $request, int $expirySeconds, string $idempotencyKey): string
    {
        return 'pm_'.$this->record('method:'.$expirySeconds, $idempotencyKey);
    }

    public function attachQr(string $paymentIntentId, string $paymentMethodId, string $idempotencyKey): string
    {
        $this->record('attach', $idempotencyKey);

        return 'data:image/png;base64,QR'.$this->counter;
    }

    public function count(string $kind): int
    {
        return count(array_filter($this->calls, fn (array $call): bool => str_starts_with($call[0], $kind)));
    }

    private function record(string $kind, string $key): string
    {
        if ($this->failing) {
            throw new PayMongoException('simulated outage');
        }
        $this->calls[] = [$kind, $key];

        // A stable id per idempotency key, like the real provider.
        return substr(md5($key), 0, 16);
    }
}
