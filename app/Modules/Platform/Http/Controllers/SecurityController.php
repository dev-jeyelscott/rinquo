<?php

namespace App\Modules\Platform\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Actions\RegenerateRecoveryCodes;
use App\Modules\Platform\Auth\PlatformSession;
use App\Modules\Platform\Auth\RecoveryCodes;
use App\Modules\Platform\Http\Requests\StepUpOnlyRequest;
use App\Modules\Platform\Models\PlatformAdmin;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class SecurityController extends Controller
{
    public function show(RecoveryCodes $codes): Response
    {
        return Inertia::render('platform/security', ['recoveryCodesRemaining' => $codes->remaining($this->admin())]);
    }

    public function regenerateCodes(StepUpOnlyRequest $request, RegenerateRecoveryCodes $regenerate): RedirectResponse
    {
        $request->session()->flash('platform.new_recovery_codes', $regenerate->handle($request->admin()));

        return to_route('platform.recovery-codes');
    }

    private function admin(): PlatformAdmin
    {
        /** @var PlatformAdmin $admin */
        $admin = Auth::guard(PlatformSession::GUARD)->user();

        return $admin;
    }
}
