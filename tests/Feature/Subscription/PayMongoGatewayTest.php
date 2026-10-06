<?php

use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\PayMongo\PayMongoException;
use App\Modules\Subscription\PayMongo\PayMongoHttpGateway;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Factory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;

beforeEach(function () {
    config([
        'services.paymongo.secret_key' => 'sk_test_abc', 'services.paymongo.webhook_secret' => 'whsec', 'services.paymongo.mode' => 'test',
        'services.paymongo.base_url' => 'https://api.paymongo.test/v1',
    ]);
    $this->request = (new PaymentRequest)->forceFill(['public_id' => 'req-1', 'organization_id' => 7, 'amount_centavos' => 99900, 'currency' => 'PHP']);
});

test('it is configured only with a secret key, a webhook secret and a known mode', function () {
    expect((new PayMongoHttpGateway)->isConfigured())->toBeTrue();

    foreach (['services.paymongo.secret_key', 'services.paymongo.webhook_secret'] as $key) {
        config([$key => '']);
        expect((new PayMongoHttpGateway)->isConfigured())->toBeFalse();
        config([$key => 'x']);
    }
    config(['services.paymongo.mode' => 'sandbox']);
    expect((new PayMongoHttpGateway)->isConfigured())->toBeFalse();
});

test('provider calls carry basic auth, a stable idempotency key and only opaque ids and the server amount', function () {
    Http::fake([
        '*/payment_intents' => Http::response(['data' => ['id' => 'pi_123']]),
        '*/payment_methods' => Http::response(['data' => ['id' => 'pm_456']]),
        '*/payment_intents/pi_123/attach' => Http::response(['data' => ['attributes' => ['next_action' => ['code' => ['image_url' => 'data:image/png;base64,QQ==']]]]]),
    ]);
    $gateway = new PayMongoHttpGateway;

    $intent = $gateway->createPaymentIntent($this->request, 'key-intent');
    $method = $gateway->createQrPaymentMethod($this->request, 1800, 'key-method');
    $image = $gateway->attachQr($intent, $method, 'key-attach');

    expect([$intent, $method, $image])->toBe(['pi_123', 'pm_456', 'data:image/png;base64,QQ==']);
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/payment_intents')
        && $request->header('Idempotency-Key') === ['key-intent']
        && $request->header('Authorization') === ['Basic '.base64_encode('sk_test_abc:')]
        && $request['data']['attributes']['amount'] === 99900
        && $request['data']['attributes']['payment_method_allowed'] === ['qrph']
        && $request['data']['attributes']['metadata'] === ['rinquo_request' => 'req-1', 'rinquo_organization' => '7']);
    Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/payment_methods') && $request['data']['attributes']['expiry_seconds'] === 1800);
});

test('provider failures, outages and unusable responses become safe exceptions without the response body', function () {
    Http::fake(['*/payment_intents' => Http::response(['errors' => [['detail' => 'sk_test_abc leaked']]], 500)]);
    try {
        (new PayMongoHttpGateway)->createPaymentIntent($this->request, 'k');
        $this->fail('expected an exception');
    } catch (PayMongoException $exception) {
        expect($exception->getMessage())->toBe('PayMongo rejected the request with HTTP 500.')->and($exception->getPrevious())->toBeNull();
    }

    Http::swap(new Factory);
    Http::fake(['*/payment_intents' => fn () => throw new ConnectionException('timeout')]);
    expect(fn () => (new PayMongoHttpGateway)->createPaymentIntent($this->request, 'k'))->toThrow(PayMongoException::class, 'could not be reached');

    Http::swap(new Factory);
    Http::fake(['*/payment_intents' => Http::response(['data' => ['id' => 'weird']])]);
    expect(fn () => (new PayMongoHttpGateway)->createPaymentIntent($this->request, 'k'))->toThrow(PayMongoException::class, 'unexpected object id');

    Http::swap(new Factory);
    Http::fake(['*/attach' => Http::response(['data' => ['attributes' => []]])]);
    expect(fn () => (new PayMongoHttpGateway)->attachQr('pi_1', 'pm_1', 'k'))->toThrow(PayMongoException::class, 'no usable QR');
});
