<?php

use Inertia\Testing\AssertableInertia as Assert;

test('the home page renders the neutral shell with runtime shared props', function () {
    config([
        'broadcasting.connections.reverb.key' => 'public-key',
        'broadcasting.connections.reverb.browser.host' => 'rinquo.example',
        'broadcasting.connections.reverb.browser.port' => 443,
        'broadcasting.connections.reverb.browser.scheme' => 'https',
    ]);

    $this->withoutVite()->get('/')
        ->assertOk()
        ->assertHeader('X-Request-Id')
        ->assertInertia(fn (Assert $page) => $page
            ->component('welcome')
            ->where('appName', config('app.name'))
            ->where('displayTimezone', 'Asia/Manila')
            ->where('realtime', [
                'key' => 'public-key',
                'host' => 'rinquo.example',
                'port' => 443,
                'scheme' => 'https',
            ]));
});
