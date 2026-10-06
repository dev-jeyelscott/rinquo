<?php

namespace App\Modules\Customer\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Booking\Models\Booking;
use App\Modules\Customer\Actions\ChangeCustomerEmail;
use App\Modules\Customer\Models\CustomerProfile;
use App\Modules\Customer\Models\CustomerVehicle;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Subscription\Access\AccessResolver;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class CustomerAccountController extends Controller
{
    private const EMAIL_TOKEN = 'customer_email_change.token';

    public function directory(Request $request, ReadinessEvaluator $readiness, AccessResolver $access): Response
    {
        $query = trim((string) $request->query('q', ''));
        // Listed only while the shop can take new bookings: restriction and closure remove it without touching published_at.
        $shops = $access->scopeAcceptingNewBookings(Organization::query()->where('directory_opted_in', true)->whereNotNull('published_at'))->with('branch')->orderBy('name')->get()
            ->filter(fn (Organization $organization): bool => $readiness->evaluate($organization)->isReady())
            ->filter(fn (Organization $organization): bool => $query === '' || str_contains(mb_strtolower($organization->name.' '.$organization->branch?->city), mb_strtolower($query)))
            ->take(50)->map(fn (Organization $organization): array => ['name' => $organization->name, 'city' => $organization->branch?->city, 'url' => route('shops.show', $organization->slug, absolute: false)])->values();

        return Inertia::render('customer/directory', ['query' => $query, 'shops' => $shops]);
    }

    public function bookings(Request $request): Response
    {
        $rows = Booking::query()->where('customer_user_id', $request->user()->id)->where('source', Booking::SOURCE_ONLINE)
            ->join('organizations', 'organizations.id', '=', 'bookings.organization_id')->join('branches', 'branches.organization_id', '=', 'organizations.id')
            ->orderByDesc('bookings.scheduled_start_at')->get(['bookings.*', 'organizations.name as shop_name', 'organizations.slug as shop_slug', 'branches.city as shop_city'])
            ->map(fn (Booking $booking): array => ['id' => $booking->public_id, 'shop' => $booking->shop_name, 'city' => $booking->shop_city, 'status' => $booking->status, 'scheduledAt' => $booking->scheduled_start_at->toIso8601String(), 'url' => route('bookings.show', [$booking->shop_slug, $booking->public_id], absolute: false)])->values();

        return Inertia::render('customer/bookings', ['bookings' => $rows]);
    }

    public function profile(Request $request): Response
    {
        $profile = CustomerProfile::query()->firstOrCreate(['user_id' => $request->user()->id]);

        return Inertia::render('customer/profile', ['profile' => ['name' => $profile->name ?? '', 'phone' => $profile->phone ?? '', 'email' => $request->user()->email], 'emailChangePending' => $request->session()->has(self::EMAIL_TOKEN)]);
    }

    public function updateProfile(Request $request): RedirectResponse
    {
        $data = $request->validate(['name' => ['nullable', 'string', 'max:120'], 'phone' => ['nullable', 'string', 'max:40']]);
        CustomerProfile::query()->updateOrCreate(['user_id' => $request->user()->id], $data);

        return to_route('customer.profile')->with('status', 'Your Rinquo profile was saved.');
    }

    public function vehicles(Request $request): Response
    {
        return Inertia::render('customer/vehicles', ['vehicles' => CustomerVehicle::query()->where('user_id', $request->user()->id)->whereNull('archived_at')->orderBy('id')->get()->map(fn (CustomerVehicle $vehicle): array => ['id' => $vehicle->id, 'plate' => $vehicle->plate, 'label' => $vehicle->label])->values()]);
    }

    public function storeVehicle(Request $request): RedirectResponse
    {
        $data = $request->validate(['plate' => ['required', 'string', 'max:20'], 'label' => ['nullable', 'string', 'max:120']]);
        $data['plate'] = strtoupper(trim($data['plate']));
        CustomerVehicle::query()->updateOrCreate(['user_id' => $request->user()->id, 'plate' => $data['plate']], $data + ['archived_at' => null]);

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
        $email = (string) $request->validate(['email' => ['required', 'email:rfc,dns', 'max:255']])['email'];
        $request->session()->put(self::EMAIL_TOKEN, $change->request($request->user(), $email, (string) $request->ip()));

        return to_route('customer.profile')->with('status', 'We sent a confirmation code to your new email address.');
    }

    public function verifyEmailChange(Request $request, ChangeCustomerEmail $change): RedirectResponse
    {
        $code = (string) $request->validate(['code' => ['required', 'digits:6']])['code'];
        $change->verify($request->user(), $request->session()->get(self::EMAIL_TOKEN), $code, (string) $request->ip());
        $request->session()->forget(self::EMAIL_TOKEN);

        return to_route('customer.profile')->with('status', 'Your Rinquo email address was changed and verified.');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return to_route('customer.auth.login');
    }
}
