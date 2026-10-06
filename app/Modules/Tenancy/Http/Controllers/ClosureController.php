<?php

namespace App\Modules\Tenancy\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Tenancy\Actions\RecoverClosure;
use App\Modules\Tenancy\Actions\RequestClosure;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

/** Owner-only explicit closure and recovery (the route's can:manage policy; Staff 403, strangers 404). */
class ClosureController extends Controller
{
    public function store(Request $request, Organization $organization, RequestClosure $close): RedirectResponse
    {
        $data = $request->validate(['confirmation' => ['required', 'string', 'max:200']]);
        $closure = $close->handle($organization, $request->user(), $data['confirmation']);
        $until = $closure->recoverable_until->setTimezone((string) config('app.display_timezone'))->format('M j, Y \a\t g:i A');

        return to_route('owner.settings.billing', $organization)->with('status', "{$organization->name} is closed. New bookings and configuration changes are stopped. Existing bookings stay open. You can recover it until {$until} (Philippine time).");
    }

    public function recover(Request $request, Organization $organization, RecoverClosure $recover): RedirectResponse
    {
        $recover->handle($organization, $request->user());

        return to_route('owner.settings.billing', $organization)->with('status', "{$organization->name} is recovered. Access now follows your subscription.");
    }
}
