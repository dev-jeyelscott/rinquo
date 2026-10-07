<?php

namespace App\Http\Middleware;

use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Support\SupportContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
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
            'platform' => fn () => $this->platform($request),
            'flash' => [
                'status' => fn () => $request->session()->get('status'),
                'schedulingImpact' => fn () => $request->session()->get('scheduling_impact'),
            ],
            'realtime' => [
                'key' => (string) config('broadcasting.connections.reverb.key'),
                'host' => (string) config('broadcasting.connections.reverb.browser.host'),
                'port' => (int) config('broadcasting.connections.reverb.browser.port'),
                'scheme' => config('broadcasting.connections.reverb.browser.scheme') === 'http' ? 'http' : 'https',
            ],
        ];
    }

    /**
     * Platform-only shared props: the signed-in administrator and, during a support view, the
     * read-only context the banner must show. Null everywhere else.
     *
     * @return array<string, mixed>|null
     */
    private function platform(Request $request): ?array
    {
        if (! $request->routeIs('platform.*')) {
            return null;
        }

        $admin = Auth::guard('platform')->user();
        $support = app()->bound(SupportContext::class) ? app(SupportContext::class) : null;

        return [
            'admin' => $admin instanceof PlatformAdmin ? ['name' => $admin->name, 'email' => $admin->email] : null,
            'support' => $support === null ? null : [
                'id' => $support->session->id,
                'organizationName' => $support->organization->name,
                'targetEmail' => $support->target->email,
                'targetRole' => $support->role,
                'reference' => $support->session->reference,
                'expiresAt' => $support->session->expires_at->toIso8601String(),
                'exitUrl' => route('platform.support.exit', $support->session->id, absolute: false),
            ],
        ];
    }
}
