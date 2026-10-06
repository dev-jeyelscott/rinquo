<?php

namespace App\Modules\Booking\Http;

use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use App\Modules\Booking\Support\BookingSession;
use App\Modules\Tenancy\Http\Storefront;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Shared by the public booking controllers: every route resolves its shop
 * through Storefront::bookableOrganization(), so a draft, unknown, unready,
 * closed or subscription-restricted shop is the same generic 404, and holds or bookings are only ever looked up
 * inside that organization.
 */
trait ResolvesShop
{
    protected function shop(Request $request, string $slug): Organization
    {
        $organization = app(Storefront::class)->bookableOrganization($slug);

        if ($organization === null) {
            throw new HttpResponseException(
                Inertia::render('shops/unavailable')->toResponse($request)->setStatusCode(404),
            );
        }

        return $organization;
    }

    /**
     * The shop of a booking that already exists. Unlike shop(), it does not
     * require the shop to be accepting new bookings: a restricted or
     * unpublished shop still lets its customers see and cancel what they hold.
     * Ownership is still enforced by ownBooking().
     */
    protected function bookingShop(string $slug): Organization
    {
        return Organization::query()->where('slug', $slug)->firstOr(fn () => abort(404));
    }

    /** The hold of this browser session inside the organization, or a 404. */
    protected function ownHold(Request $request, Organization $organization, string $publicId): Hold
    {
        $token = (new BookingSession($request->session()))->existingToken();

        $hold = $token === null ? null : Hold::query()
            ->where('organization_id', $organization->id)
            ->where('public_id', $publicId)
            ->where('session_token_hash', hash('sha256', $token))
            ->first();

        abort_if($hold === null, 404);

        return $hold;
    }

    protected function ownBooking(Request $request, Organization $organization, string $publicId): Booking
    {
        $booking = $request->user() === null ? null : Booking::query()
            ->where('organization_id', $organization->id)
            ->where('public_id', $publicId)
            ->where('customer_user_id', $request->user()->id)
            ->first();

        abort_if($booking === null, 404);

        return $booking;
    }
}
