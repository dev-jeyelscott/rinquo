<?php

namespace Tests\Support;

use App\Modules\Booking\Models\Hold;
use Illuminate\Support\Str;
use Illuminate\Testing\TestResponse;

/** HTTP helpers for the customer booking journey (one call per wizard step). */
final class Journey
{
    public static function holdPayload(Shop $shop, string $localStart = '2026-10-06 10:00', array $addOnIds = [], ?string $key = null): array
    {
        return [
            'idempotency_key' => $key ?? (string) Str::uuid(),
            'vehicle_type_id' => $shop->records->vehicle->id,
            'service_id' => $shop->records->service->id,
            'add_on_ids' => $addOnIds,
            'start_at' => Shop::at($localStart)->toIso8601String(),
            'vehicle_make_model' => 'Toyota Vios',
        ];
    }

    public static function placeHold(Shop $shop, string $localStart = '2026-10-06 10:00', array $addOnIds = [], ?string $key = null): TestResponse
    {
        return test()->post(route('bookings.holds.store', $shop->organization->slug), self::holdPayload($shop, $localStart, $addOnIds, $key));
    }

    /** Places a hold and returns it (asserting the redirect to its details page). */
    public static function hold(Shop $shop, string $localStart = '2026-10-06 10:00', array $addOnIds = []): Hold
    {
        self::placeHold($shop, $localStart, $addOnIds)->assertSessionHasNoErrors()->assertRedirect();
        $hold = Hold::query()->latest('id')->firstOrFail();

        return $hold;
    }

    public static function saveDetails(Shop $shop, Hold $hold, array $overrides = []): TestResponse
    {
        return test()->put(route('bookings.holds.details.save', [$shop->organization->slug, $hold->public_id]), $overrides + [
            'contact_name' => 'Ana Cruz',
            'contact_phone' => '+63 912 345 6789',
            'vehicle_make_model' => 'Toyota Vios',
            'vehicle_plate' => 'ABC 123',
            'customer_notes' => 'Please rinse the wheels.',
        ]);
    }

    public static function confirm(Shop $shop, Hold $hold): TestResponse
    {
        return test()->post(route('bookings.holds.confirm', [$shop->organization->slug, $hold->public_id]));
    }

    /** True when no key at any depth matches one of the internals customers must never see. */
    public static function leaksInternals(mixed $payload): bool
    {
        $forbidden = ['capacity', 'units', 'physical_resource', 'physicalresource', 'resource', 'load', 'consumption', 'buffer', 'bufferminutes', 'buffer_minutes'];
        $walk = function (mixed $node) use (&$walk, $forbidden): bool {
            if (! is_array($node)) {
                return false;
            }
            foreach ($node as $key => $value) {
                if (is_string($key) && in_array(strtolower($key), $forbidden, true)) {
                    return true;
                }
                if ($walk($value)) {
                    return true;
                }
            }

            return false;
        };

        return $walk($payload);
    }
}
