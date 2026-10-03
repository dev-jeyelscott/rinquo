<?php

use Illuminate\Support\Facades\Route;
use Inertia\Testing\AssertableInertia as Assert;

test('state-changing web requests without a CSRF token are rejected', function () {
    Route::middleware('web')->post('/__test/csrf', fn () => 'accepted');

    // The framework skips CSRF verification while running unit tests, so
    // evaluate this request as a regular (non-testing) environment would.
    $this->app['env'] = 'local';

    try {
        $this->post('/__test/csrf')->assertStatus(419);
    } finally {
        $this->app['env'] = 'testing';
    }
});

test('session cookie is secure and http-only with production cookie settings', function () {
    config(['session.secure' => true, 'session.http_only' => true, 'session.same_site' => 'lax']);

    $cookie = $this->withoutVite()->get('/')->assertOk()->getCookie(config('session.cookie'), false);

    expect($cookie)->not->toBeNull()
        ->and($cookie->isSecure())->toBeTrue()
        ->and($cookie->isHttpOnly())->toBeTrue()
        ->and($cookie->getSameSite())->toBe('lax');
});

test('error responses do not expose stack traces or exception messages when debug is off', function () {
    config(['app.debug' => false]);
    Route::get('/__test/explode', fn () => throw new RuntimeException('sensitive-internal-detail'));

    $json = $this->getJson('/__test/explode')->assertStatus(500);
    expect($json->getContent())
        ->not->toContain('sensitive-internal-detail')
        ->not->toContain('trace')
        ->not->toContain('RuntimeException');

    $html = $this->get('/__test/explode')->assertStatus(500);
    expect($html->getContent())
        ->not->toContain('sensitive-internal-detail')
        ->not->toContain('RuntimeException');
});

test('shared props never include the Reverb app secret', function () {
    config(['broadcasting.connections.reverb.secret' => 'reverb-secret-must-not-leak']);

    $response = $this->withoutVite()->get('/');

    $response->assertInertia(fn (Assert $page) => $page
        ->has('realtime', fn (Assert $realtime) => $realtime
            ->hasAll(['key', 'host', 'port', 'scheme'])
            ->missing('secret')));

    expect($response->getContent())->not->toContain('reverb-secret-must-not-leak');
});
