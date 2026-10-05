<?php

namespace App\Http\Middleware;

use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * Realtime settings are shared at runtime (not baked in at build time) so
     * the same image runs in staging and production. Only public values are
     * exposed: never add the Reverb app secret here.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'appName' => config('app.name'),
            'displayTimezone' => config('app.display_timezone'),
            'auth' => [
                'user' => $request->user() === null ? null : ['email' => $request->user()->email],
            ],
            'flash' => [
                'status' => fn () => $request->session()->get('status'),
            ],
            'realtime' => [
                'key' => (string) config('broadcasting.connections.reverb.key'),
                'host' => (string) config('broadcasting.connections.reverb.browser.host'),
                'port' => (int) config('broadcasting.connections.reverb.browser.port'),
                'scheme' => config('broadcasting.connections.reverb.browser.scheme') === 'http' ? 'http' : 'https',
            ],
        ];
    }
}
