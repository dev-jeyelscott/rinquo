<?php

namespace App\Modules\Subscription\PayMongo;

use App\Modules\Subscription\Models\PaymentRequest;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Facades\Http;

/** Laravel HTTP client adapter with finite timeouts. The secret key never leaves this class. */
final class PayMongoHttpGateway implements PayMongoGateway
{
    public function isConfigured(): bool
    {
        return $this->secretKey() !== '' && (string) config('services.paymongo.webhook_secret') !== '' && in_array($this->mode(), ['test', 'live'], true);
    }

    public function mode(): string
    {
        return (string) config('services.paymongo.mode');
    }

    public function createPaymentIntent(PaymentRequest $request, string $idempotencyKey): string
    {
        $response = $this->post('/payment_intents', [
            'amount' => $request->amount_centavos,
            'currency' => $request->currency,
            'payment_method_allowed' => ['qrph'],
            'capture_type' => 'automatic',
            'description' => 'Rinquo subscription renewal',
            'statement_descriptor' => 'Rinquo',
            // Opaque local ids only: the provider never receives names, emails or secrets.
            'metadata' => ['rinquo_request' => $request->public_id, 'rinquo_organization' => (string) $request->organization_id],
        ], $idempotencyKey);

        return $this->id($response, 'pi_');
    }

    public function createQrPaymentMethod(PaymentRequest $request, int $expirySeconds, string $idempotencyKey): string
    {
        $response = $this->post('/payment_methods', ['type' => 'qrph', 'expiry_seconds' => $expirySeconds], $idempotencyKey);

        return $this->id($response, 'pm_');
    }

    public function attachQr(string $paymentIntentId, string $paymentMethodId, string $idempotencyKey): string
    {
        $response = $this->post('/payment_intents/'.rawurlencode($paymentIntentId).'/attach', ['payment_method' => $paymentMethodId], $idempotencyKey);
        $image = data_get($response, 'data.attributes.next_action.code.image_url');

        if (! is_string($image) || ! str_starts_with($image, 'data:image/') || strlen($image) > 200_000) {
            throw new PayMongoException('PayMongo returned no usable QR image.');
        }

        return $image;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function post(string $path, array $attributes, string $idempotencyKey): array
    {
        try {
            $response = $this->client($idempotencyKey)->post($path, ['data' => ['attributes' => $attributes]])->throw();
        } catch (ConnectionException) {
            // The cause is deliberately not chained: its message can carry the provider's response body.
            throw new PayMongoException('PayMongo could not be reached.');
        } catch (RequestException $e) {
            throw new PayMongoException('PayMongo rejected the request with HTTP '.$e->response->status().'.');
        }

        $json = $response->json();

        return is_array($json) ? $json : throw new PayMongoException('PayMongo returned an unreadable response.');
    }

    private function client(string $idempotencyKey): PendingRequest
    {
        return Http::baseUrl((string) config('services.paymongo.base_url'))
            ->withBasicAuth($this->secretKey(), '')
            ->withHeaders(['Idempotency-Key' => $idempotencyKey])
            ->acceptJson()
            ->asJson()
            ->connectTimeout((int) config('services.paymongo.connect_timeout'))
            ->timeout((int) config('services.paymongo.timeout'));
    }

    /** @param  array<string, mixed>  $response */
    private function id(array $response, string $prefix): string
    {
        $id = data_get($response, 'data.id');

        return is_string($id) && str_starts_with($id, $prefix) && strlen($id) <= 80
            ? $id
            : throw new PayMongoException('PayMongo returned an unexpected object id.');
    }

    private function secretKey(): string
    {
        return (string) config('services.paymongo.secret_key');
    }
}
