<?php

namespace App\Modules\Subscription\PayMongo;

use App\Modules\Subscription\Models\PaymentRequest;

/**
 * The outbound PayMongo boundary for dynamic QR Ph. Every call carries a stable
 * idempotency key so a retry after an uncertain response never duplicates a
 * remote object. Implementations never trust or return client-supplied state.
 */
interface PayMongoGateway
{
    /** True only when every credential needed to create and verify payments is configured. */
    public function isConfigured(): bool;

    /** The configured mode, `test` or `live`. */
    public function mode(): string;

    /** Creates the Payment Intent and returns its provider id. */
    public function createPaymentIntent(PaymentRequest $request, string $idempotencyKey): string;

    /** Creates a qrph Payment Method valid for the given seconds and returns its provider id. */
    public function createQrPaymentMethod(PaymentRequest $request, int $expirySeconds, string $idempotencyKey): string;

    /** Attaches the method to the intent and returns the Base64 QR image data. */
    public function attachQr(string $paymentIntentId, string $paymentMethodId, string $idempotencyKey): string;
}
