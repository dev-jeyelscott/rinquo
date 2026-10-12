<?php

namespace App\Modules\Customer\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Models\Booking;
use App\Modules\Customer\Actions\ChangeCustomerEmail;
use App\Modules\Customer\Actions\SaveCustomerVehicle;
use App\Modules\Customer\Directory\ShopDirectory;
use App\Modules\Customer\Models\CustomerProfile;
use App\Modules\Customer\Models\CustomerVehicle;
use App\Modules\Identity\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class CustomerAccountController extends Controller
{
    private const EMAIL_TOKEN = 'customer_email_change.token';

    private const EMAIL_PENDING = 'customer_email_change.email';

    private const BOOKINGS_PER_PAGE = 20;

    public function directory(Request $request, ShopDirectory $directory): Response
    {
        $query = mb_substr(trim((string) $request->query('q', '')), 0, 120);

        return Inertia::render('customer/directory', ['query' => $query, ...$directory->search($query)]);
    }

    /** Only this signed-in customer's verified online bookings; staff-entered contact emails never link activity. */
    public function bookings(Request $request): Response
    {
        $page = Booking::query()->where('customer_user_id', $request->user()->id)->where('source', Booking::SOURCE_ONLINE)
            ->join('organizations', 'organizations.id', '=', 'bookings.organization_id')->join('branches', 'branches.organization_id', '=', 'organizations.id')
            ->orderByDesc('bookings.scheduled_start_at')->orderByDesc('bookings.id')
            ->paginate(self::BOOKINGS_PER_PAGE, ['bookings.*', 'organizations.name as shop_name', 'organizations.slug as shop_slug', 'branches.city as shop_city']);

        return Inertia::render('customer/bookings', [
            'bookings' => array_map(fn (Booking $booking): array => [
                'id' => $booking->public_id,
                'shop' => $booking->getAttribute('shop_name'),
                'city' => $booking->getAttribute('shop_city'),
                // A confirmed booking's customer-facing progress (checked in, in service, completed, no-show) wins over "confirmed".
                'status' => $booking->status === Booking::CONFIRMED && $booking->operational_state !== Booking::SCHEDULED ? $booking->operational_state : $booking->status,
                'scheduledAt' => $booking->scheduled_start_at->toIso8601String(),
                'timezone' => $booking->branch_timezone,
                'url' => route('bookings.show', [$booking->getAttribute('shop_slug'), $booking->public_id], absolute: false),
            ], $page->items()),
            'pageInfo' => ['page' => $page->currentPage(), 'perPage' => $page->perPage(), 'total' => $page->total(), 'lastPage' => $page->lastPage(), 'from' => $page->firstItem() ?? 0, 'to' => $page->lastItem() ?? 0],
        ]);
    }

    public function profile(Request $request): Response
    {
        $profile = CustomerProfile::query()->firstOrCreate(['user_id' => $request->user()->id]);

        $pending = $request->session()->get(self::EMAIL_PENDING);

        return Inertia::render('customer/profile', [
            'profile' => ['name' => $profile->name ?? '', 'phone' => $profile->phone ?? '', 'email' => $request->user()->email, 'emailVerified' => $request->user()->email_verified_at !== null],
            'emailChange' => [
                'pendingEmail' => $request->session()->has(self::EMAIL_TOKEN) && is_string($pending) ? $pending : null,
                'changedTo' => $request->session()->get('email_changed_to'),
            ],
        ]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['nullable', 'string', 'max:120'], 'phone' => ['nullable', 'string', 'max:40']]);
        CustomerProfile::query()->updateOrCreate(['user_id' => $request->user()->id], $data);

        return to_route('customer.profile')->with('status', 'Your Rinquo profile was saved.');
    }

    public function vehicles(Request $request): Response
    {
        return Inertia::render('customer/vehicles', ['vehicles' => CustomerVehicle::query()->where('user_id', $request->user()->id)->whereNull('archived_at')->orderBy('id')->get()->map(fn (CustomerVehicle $vehicle): array => ['id' => $vehicle->id, 'makeModel' => $vehicle->make_model, 'plate' => $vehicle->plate, 'label' => $vehicle->label])->values()]);
    }

    public function storeVehicle(Request $request, SaveCustomerVehicle $save): RedirectResponse
    {
        $data = $request->validate([
            'make_model' => ['required', 'string', 'max:120', 'regex:/\S/'],
            'plate' => ['nullable', 'string', 'max:20'],
            'label' => ['nullable', 'string', 'max:120'],
        ], ['make_model.required' => 'Enter your vehicle make and model.', 'make_model.regex' => 'Enter your vehicle make and model.']);
        $save->handle($request->user(), $data['make_model'], $data['plate'] ?? null, isset($data['label']) && trim($data['label']) !== '' ? trim($data['label']) : null);

        return to_route('customer.vehicles')->with('status', 'Vehicle saved to your Rinquo account.');
    }

    public function archiveVehicle(Request $request, CustomerVehicle $vehicle): RedirectResponse
    {
        abort_unless($vehicle->user_id === $request->user()->id, 404);
        $vehicle->forceFill(['archived_at' => now()])->save();

        return to_route('customer.vehicles')->with('status', 'Vehicle archived. Existing bookings were not changed.');
    }

    public function requestEmailChange(Request $request, ChangeCustomerEmail $change): RedirectResponse
    {
        $email = (string) $request->validate(['email' => ['required', 'email:rfc', 'max:254']])['email'];
        // The session moves to the new challenge only after its code was sent.
        $request->session()->put([self::EMAIL_TOKEN => $change->request($request->user(), $email, (string) $request->ip()), self::EMAIL_PENDING => User::normalizeEmail($email)]);

        return to_route('customer.profile')->with('status', 'We sent a confirmation code to your new email address.');
    }

    public function verifyEmailChange(Request $request, ChangeCustomerEmail $change): RedirectResponse
    {
        $code = (string) $request->validate(['code' => ['required', 'digits:6']])['code'];
        $change->verify($request->user(), $request->session()->get(self::EMAIL_TOKEN), $code, (string) $request->ip());
        $request->session()->forget([self::EMAIL_TOKEN, self::EMAIL_PENDING]);

        return to_route('customer.profile')->with('email_changed_to', $request->user()->email);
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('customer.auth.login');
    }
}
