<?php

use App\Modules\Platform\Http\Controllers\AdminsController;
use App\Modules\Platform\Http\Controllers\AuthController;
use App\Modules\Platform\Http\Controllers\FailedJobsController;
use App\Modules\Platform\Http\Controllers\InvitationController;
use App\Modules\Platform\Http\Controllers\OrganizationsController;
use App\Modules\Platform\Http\Controllers\OverviewController;
use App\Modules\Platform\Http\Controllers\PasswordResetController;
use App\Modules\Platform\Http\Controllers\PlanTermsController;
use App\Modules\Platform\Http\Controllers\SecurityController;
use App\Modules\Platform\Http\Controllers\SupportController;
use App\Modules\Platform\Http\Controllers\SupportExitController;
use App\Modules\Platform\Http\Middleware\EnsurePlatformAdmin;
use App\Modules\Platform\Http\Middleware\RedirectAuthenticatedAdmin;
use App\Modules\Platform\Http\Middleware\ResolveSupportContext;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Platform administration (/platform)
|--------------------------------------------------------------------------
|
| Registered under the "platform" middleware group: its own session cookie, the
| platform guard as default, no public registration. Sign-in is two steps; the guard is
| logged in only after the second factor.
*/

Route::middleware(RedirectAuthenticatedAdmin::class)->group(function (): void {
    Route::get('login', [AuthController::class, 'showLogin'])->name('login');
});
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:20,1')->name('login.attempt');

// Password-pending state (not authenticated): factor, enrollment, reset and invitation.
Route::get('mfa', [AuthController::class, 'showFactor'])->name('mfa');
Route::post('mfa', [AuthController::class, 'verifyFactor'])->name('mfa.verify');
Route::get('enroll', [AuthController::class, 'showEnroll'])->name('enroll');
Route::post('enroll', [AuthController::class, 'confirmEnroll'])->name('enroll.confirm');
Route::get('forgot-password', [PasswordResetController::class, 'showForgot'])->name('password.request');
Route::post('forgot-password', [PasswordResetController::class, 'sendLink'])->name('password.email');
Route::get('reset-password/{token}', [PasswordResetController::class, 'showReset'])->name('password.reset');
Route::post('reset-password', [PasswordResetController::class, 'reset'])->name('password.update');
Route::get('invitations/{token}', [InvitationController::class, 'show'])->name('invitation.show');
Route::post('invitations/{token}', [InvitationController::class, 'accept'])->name('invitation.accept');

Route::middleware(EnsurePlatformAdmin::class)->group(function (): void {
    Route::post('logout', [AuthController::class, 'logout'])->name('logout');
    Route::get('/', OverviewController::class)->name('overview');
    Route::get('recovery-codes', [AuthController::class, 'showRecoveryCodes'])->name('recovery-codes');

    Route::get('security', [SecurityController::class, 'show'])->name('security');
    Route::post('security/recovery-codes', [SecurityController::class, 'regenerateCodes'])->name('security.recovery-codes');

    Route::get('admins', [AdminsController::class, 'index'])->name('admins');
    Route::post('admins/invitations', [AdminsController::class, 'invite'])->name('admins.invite');
    Route::post('admins/invitations/{invitation}/revoke', [AdminsController::class, 'revokeInvitation'])->name('admins.invitations.revoke');
    Route::post('admins/{admin}/disable', [AdminsController::class, 'disable'])->name('admins.disable');
    Route::post('admins/{admin}/enable', [AdminsController::class, 'enable'])->name('admins.enable');
    Route::post('admins/{admin}/reset-factor', [AdminsController::class, 'resetFactor'])->name('admins.reset-factor');

    Route::get('organizations', [OrganizationsController::class, 'index'])->name('organizations');
    Route::get('organizations/{organization}', [OrganizationsController::class, 'show'])->name('organizations.show');
    Route::post('organizations/{organization}/support-sessions', [OrganizationsController::class, 'startSupport'])->name('organizations.support.start');

    Route::get('plan-terms', [PlanTermsController::class, 'show'])->name('plan-terms');
    Route::post('plan-terms', [PlanTermsController::class, 'publish'])->name('plan-terms.publish');

    Route::get('failed-jobs', [FailedJobsController::class, 'index'])->name('failed-jobs');
    Route::post('failed-jobs/{job}/retry', [FailedJobsController::class, 'retry'])->whereUuid('job')->name('failed-jobs.retry');

    // Read-only tenant support. Exit is the only write; everything else passes ResolveSupportContext,
    // which refuses every non-read method before a controller runs and audits each request.
    Route::post('support/{supportSession}/exit', SupportExitController::class)->whereUuid('supportSession')->name('support.exit');
    Route::middleware(ResolveSupportContext::class)->prefix('support/{supportSession}')->whereUuid('supportSession')->name('support.')->group(function (): void {
        Route::get('/', [SupportController::class, 'overview'])->name('overview');
        Route::get('booking-requests', [SupportController::class, 'bookingRequests'])->name('booking-requests');
        Route::match(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], '{path?}', [SupportController::class, 'notAllowlisted'])->where('path', '.*')->name('blocked');
    });
});
