<?php

namespace App\Modules\Booking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Actions\ConfirmBooking;
use App\Modules\Booking\Actions\PlaceHold;
use App\Modules\Booking\Actions\SaveHoldDetails;
use App\Modules\Booking\Availability\BranchCalendar;
use App\Modules\Booking\Http\Requests\HoldDetailsRequest;
use App\Modules\Booking\Http\Requests\PlaceHoldRequest;
use App\Modules\Booking\Http\ResolvesShop;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Support\BookingSession;
use App\Modules\Booking\Support\HoldSummary;
use App\Modules\Identity\Actions\RequestLoginCode;
use App\Modules\Identity\Actions\VerifyLoginCode;
use App\Modules\Identity\Http\Requests\VerifyLoginCodeRequest;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Http\Storefront;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The hold-bound steps of the customer journey: place the hold at Schedule,
 * capture details, verify the email with a code, review and confirm. A hold is
 * only reachable by the browser session that created it, inside its shop;
 * anything else is a 404. The server decides every transition regardless of
 * the order the wizard walks them.
 */
class HoldController extends Controller
{
    use ResolvesShop;

    public function store(PlaceHoldRequest $request, string $slug, PlaceHold $placeHold): RedirectResponse
    {
        $organization = $this->shop($request, $slug);

        $hold = $placeHold->handle(
            $organization,
            (string) $request->validated('idempotency_key'),
            (int) $request->validated('vehicle_type_id'),
            (int) $request->validated('service_id'),
            $request->addOnIds(),
            $request->startAt(),
            (new BookingSession($request->session()))->token(),
        );

        return to_route('bookings.holds.details', [$slug, $hold->public_id]);
    }

    public function details(Request $request, string $slug, string $hold, Storefront $storefront, HoldSummary $summary): Response|RedirectResponse
    {
        $organization = $this->shop($request, $slug);
        $record = $this->ownHold($request, $organization, $hold);

        if ($redirect = $this->settled($slug, $record)) {
            return $redirect;
        }

        return Inertia::render('shops/book/details', [
            ...$storefront->shell($organization),
            ...$this->holdProps($request, $slug, $organization, $record, $summary),
            'contact' => [
                'name' => $record->contact_name ?? '',
                'phone' => $record->contact_phone ?? '',
                'plate' => $record->vehicle_plate ?? '',
                'notes' => $record->customer_notes ?? '',
            ],
            'verification' => (new BookingSession($request->session()))->verificationState($request->user() !== null),
        ]);
    }

    public function saveDetails(
        HoldDetailsRequest $request,
        string $slug,
        string $hold,
        SaveHoldDetails $save,
        RequestLoginCode $requestCode,
    ): RedirectResponse {
        $organization = $this->shop($request, $slug);
        $record = $this->ownHold($request, $organization, $hold);

        if ($redirect = $this->settled($slug, $record)) {
            return $redirect;
        }

        $save->handle($record, $request->details());

        if ($request->user() !== null) {
            return to_route('bookings.holds.confirm.show', [$slug, $record->public_id]);
        }

        $session = new BookingSession($request->session());
        $email = User::normalizeEmail((string) $request->validated('email'));
        $state = $session->verificationState(false);

        // Editing details while a code for the same email is pending must not burn the resend cooldown.
        if ($state['step'] === 'code' && $state['email'] === $email) {
            return to_route('bookings.holds.details', [$slug, $record->public_id]);
        }

        $session->rememberVerification($requestCode->handle($email, (string) $request->ip(), $organization->name), $email);

        return to_route('bookings.holds.details', [$slug, $record->public_id]);
    }

    public function requestCode(Request $request, string $slug, string $hold, RequestLoginCode $requestCode): RedirectResponse
    {
        $organization = $this->shop($request, $slug);
        $record = $this->ownHold($request, $organization, $hold);
        $session = new BookingSession($request->session());
        $email = $session->verificationState(false)['email'];

        if ($request->user() !== null || $email === null) {
            return to_route('bookings.holds.details', [$slug, $record->public_id]);
        }

        $session->rememberVerification($requestCode->handle($email, (string) $request->ip(), $organization->name), $email);

        return to_route('bookings.holds.details', [$slug, $record->public_id]);
    }

    public function verify(VerifyLoginCodeRequest $request, string $slug, string $hold, VerifyLoginCode $verify): RedirectResponse
    {
        $organization = $this->shop($request, $slug);
        $record = $this->ownHold($request, $organization, $hold);
        $session = new BookingSession($request->session());

        $user = $verify->handle($session->challengeToken(), (string) $request->validated('code'), (string) $request->ip());

        // Verification proves ownership of the email, so linking to the existing account is safe.
        Auth::login($user);
        $session->forgetVerification();
        $request->session()->regenerate();

        return to_route('bookings.holds.confirm.show', [$slug, $record->public_id]);
    }

    public function restart(Request $request, string $slug, string $hold): RedirectResponse
    {
        $organization = $this->shop($request, $slug);
        $record = $this->ownHold($request, $organization, $hold);
        (new BookingSession($request->session()))->forgetVerification();

        return to_route('bookings.holds.details', [$slug, $record->public_id]);
    }

    public function review(Request $request, string $slug, string $hold, Storefront $storefront, HoldSummary $summary): Response|RedirectResponse
    {
        $organization = $this->shop($request, $slug);
        $record = $this->ownHold($request, $organization, $hold);

        if ($redirect = $this->settled($slug, $record)) {
            return $redirect;
        }

        if ($request->user() === null || ! $record->hasDetails()) {
            return to_route('bookings.holds.details', [$slug, $record->public_id]);
        }

        return Inertia::render('shops/book/confirm', [
            ...$storefront->shell($organization),
            ...$this->holdProps($request, $slug, $organization, $record, $summary),
            'contact' => [
                'name' => $record->contact_name,
                'phone' => $record->contact_phone,
                'plate' => $record->vehicle_plate,
                'notes' => $record->customer_notes,
            ],
            'customerEmail' => $request->user()->email,
        ]);
    }

    public function confirm(Request $request, string $slug, string $hold, ConfirmBooking $confirm): RedirectResponse
    {
        $organization = $this->shop($request, $slug);
        $record = $this->ownHold($request, $organization, $hold);

        if ($request->user() === null) {
            return to_route('bookings.holds.details', [$slug, $record->public_id]);
        }

        try {
            $booking = $confirm->handle($organization, $hold, (new BookingSession($request->session()))->token(), $request->user());
        } catch (ValidationException $exception) {
            // A missing detail is fixed on the Details step; a lost time stays on this page with the selection kept.
            if (isset($exception->errors()['contact_name'])) {
                return to_route('bookings.holds.details', [$slug, $record->public_id])->withErrors($exception->errors());
            }

            throw $exception;
        }

        return to_route('bookings.show', [$slug, $booking->public_id]);
    }

    /** A converted hold continues at its booking; a released one starts over at Schedule. */
    private function settled(string $slug, Hold $hold): ?RedirectResponse
    {
        if ($hold->status === Hold::CONVERTED) {
            return to_route('bookings.show', [$slug, $hold->booking()->firstOrFail()->public_id]);
        }

        return $hold->status === Hold::RELEASED ? to_route('bookings.wizard', $slug) : null;
    }

    /** @return array<string, mixed> */
    private function holdProps(Request $request, string $slug, Organization $organization, Hold $hold, HoldSummary $summary): array
    {
        try {
            $details = $summary->for($organization, $hold);
        } catch (ValidationException) {
            // The offer was withdrawn while the customer was checking out.
            throw new HttpResponseException(to_route('bookings.wizard', $slug));
        }

        $base = "/shops/{$slug}/book/holds/{$hold->public_id}";

        return [
            'hold' => [
                'publicId' => $hold->public_id,
                'expiresInSeconds' => (int) max(0, now()->diffInSeconds($hold->expires_at, false)),
                'expired' => ! $hold->isLive(),
            ],
            'summary' => $details,
            'urls' => [
                'details' => "{$base}/details",
                'code' => "{$base}/code",
                'verify' => "{$base}/verify",
                'restart' => "{$base}/restart",
                'confirm' => "{$base}/confirm",
                'wizard' => route('bookings.wizard', [
                    'slug' => $slug,
                    'vehicle' => $details['vehicleTypeId'],
                    'service' => $details['serviceId'],
                    'addOns' => $details['addOnIds'],
                    'date' => BranchCalendar::localDate($hold->scheduled_start_at)->toDateString(),
                ], absolute: false),
                'shop' => route('shops.show', $slug, absolute: false),
            ],
            'signedIn' => $request->user() !== null,
        ];
    }
}
