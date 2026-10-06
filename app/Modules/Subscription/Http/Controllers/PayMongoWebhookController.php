<?php

namespace App\Modules\Subscription\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Subscription\Actions\RecordWebhookEvent;
use App\Modules\Subscription\PayMongo\PayMongoGateway;
use App\Modules\Subscription\PayMongo\WebhookSignature;
use App\Modules\Subscription\Support\PlanTerms;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The public PayMongo webhook. It reads the unmodified raw body, verifies the
 * HMAC and timestamp in constant time, validates the envelope and durably
 * stores the event before acknowledging. An unsigned, stale, oversized or
 * malformed request is refused without queueing anything. The route sits
 * outside the web group (no session, cookie or CSRF).
 */
class PayMongoWebhookController extends Controller
{
    private const MAX_BYTES = 65_536;

    public function __invoke(Request $request, RecordWebhookEvent $record, PayMongoGateway $gateway): JsonResponse
    {
        $body = $request->getContent();

        if (strlen($body) > self::MAX_BYTES) {
            return response()->json(['message' => 'Payload too large.'], 413);
        }

        $verified = WebhookSignature::verify(
            $body,
            $request->header('Paymongo-Signature'),
            (string) config('services.paymongo.webhook_secret'),
            $gateway->mode(),
            PlanTerms::current()->signatureToleranceSeconds,
        );

        if (! $verified) {
            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        $payload = json_decode($body, true);

        if (! is_array($payload) || $record->handle($payload, $gateway->mode()) === null) {
            return response()->json(['message' => 'Unrecognized event.'], 422);
        }

        return response()->json(['received' => true]);
    }
}
