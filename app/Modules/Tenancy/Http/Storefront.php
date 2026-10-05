<?php

namespace App\Modules\Tenancy\Http;

use App\Modules\Scheduling\Models\BranchDateOverride;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Organization;
use App\Modules\Tenancy\Models\OrganizationMedia;
use Carbon\CarbonImmutable;

/**
 * Builds the public storefront payload. A shop is visible only while it is
 * published AND still passes the shared readiness evaluator. The payload
 * carries only active, complete variants and never exposes physical resources,
 * capacities, consumption units, audit data or draft configuration.
 */
final class Storefront
{
    private const DAYS = [1 => 'Monday', 2 => 'Tuesday', 3 => 'Wednesday', 4 => 'Thursday', 5 => 'Friday', 6 => 'Saturday', 7 => 'Sunday'];

    public function __construct(private readonly ReadinessEvaluator $readiness) {}

    /** Resolves a publicly visible organization, or null (draft, unknown or unready). */
    public function visibleOrganization(string $slug): ?Organization
    {
        $organization = Organization::query()->where('slug', $slug)->first();

        if ($organization === null || ! $organization->isPublished()) {
            return null;
        }

        return $this->readiness->evaluate($organization)->isReady() ? $organization : null;
    }

    /** @return array<string, mixed> */
    public function payload(Organization $organization, ?CarbonImmutable $now = null): array
    {
        $available = $this->readiness->evaluate($organization)->availableVariantIds();

        return [
            ...$this->shell($organization, $now),
            'services' => $this->services($organization, $available),
            // A visible shop is published and ready, so it accepts online booking.
            'bookingAvailable' => true,
            'bookingUrl' => route('bookings.wizard', $organization->slug, absolute: false),
        ];
    }

    /**
     * The props the tenant-branded shell needs on every public page: shop
     * identity and brand, the branch, and today's open/closed state.
     *
     * @return array{shop: array<string, mixed>, branch: array<string, mixed>, hours: array<string, mixed>}
     */
    public function shell(Organization $organization, ?CarbonImmutable $now = null): array
    {
        $now = ($now ?? CarbonImmutable::now())->setTimezone(Branch::TIMEZONE);
        $branch = $organization->branch()->firstOrFail();

        $media = $organization->media()->active()->orderBy('sort_order')->get();
        $mediaUrl = fn (?OrganizationMedia $item): ?array => $item === null ? null : [
            'url' => route('shops.media', [$organization->slug, $item->id], absolute: false),
            'altText' => $item->alt_text,
        ];

        return [
            'shop' => [
                'name' => $organization->name,
                'tagline' => $organization->tagline,
                'description' => $organization->description,
                'brandColor' => $organization->brand_color,
                'logo' => $mediaUrl($media->firstWhere('kind', OrganizationMedia::LOGO)),
                'hero' => $mediaUrl($media->firstWhere('kind', OrganizationMedia::HERO)),
                'gallery' => $media->where('kind', OrganizationMedia::GALLERY)->map($mediaUrl)->values()->all(),
            ],
            'branch' => [
                'name' => $branch->name,
                'addressLine' => $branch->address_line,
                'city' => $branch->city,
                'phone' => $branch->phone,
                'timezone' => $branch->timezone,
            ],
            'hours' => $this->hours($organization, $now),
        ];
    }

    /** @return array{openNow: bool, today: string, weekly: list<array{day: string, label: string}>} */
    private function hours(Organization $organization, CarbonImmutable $now): array
    {
        $weekly = BranchWeeklyHour::query()->where('organization_id', $organization->id)->orderBy('weekday')->orderBy('opens_at')->get();
        $override = BranchDateOverride::query()
            ->where('organization_id', $organization->id)
            ->whereDate('local_date', $now->toDateString())
            ->first();

        $todayIntervals = $override !== null
            ? ($override->is_closed ? [] : [[$override->opens_at, $override->closes_at]])
            : $weekly->where('weekday', $now->dayOfWeekIso)->map(fn ($row): array => [$row->opens_at, $row->closes_at])->values()->all();

        $minutes = $now->hour * 60 + $now->minute;
        $openNow = false;
        foreach ($todayIntervals as [$opens, $closes]) {
            if (ReadinessEvaluator::minutes($opens) <= $minutes && $minutes < ReadinessEvaluator::minutes($closes)) {
                $openNow = true;
            }
        }

        $format = fn (array $interval): string => self::clock($interval[0]).' - '.self::clock($interval[1]);

        $weeklyLabels = [];
        foreach (self::DAYS as $weekday => $day) {
            $intervals = $weekly->where('weekday', $weekday)->map(fn ($row): array => [$row->opens_at, $row->closes_at])->values()->all();
            $weeklyLabels[] = ['day' => $day, 'label' => $intervals === [] ? 'Closed' : implode(', ', array_map($format, $intervals))];
        }

        return [
            'openNow' => $openNow,
            'today' => $todayIntervals === [] ? 'Closed today' : implode(', ', array_map($format, $todayIntervals)),
            'weekly' => $weeklyLabels,
        ];
    }

    /**
     * @param  list<int>  $availableVariantIds
     * @return array<int, array<string, mixed>>
     */
    private function services(Organization $organization, array $availableVariantIds): array
    {
        $variants = ServiceVehicleVariant::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $availableVariantIds)
            ->with('vehicleType')
            ->orderBy('price_centavos')
            ->get()
            ->groupBy('service_id');

        return Service::query()
            ->where('organization_id', $organization->id)
            ->whereIn('id', $variants->keys())
            ->orderBy('name')
            ->get()
            ->map(fn (Service $service): array => [
                'id' => $service->id,
                'name' => $service->name,
                'description' => $service->description,
                'fromPriceCentavos' => (int) $variants[$service->id]->min('price_centavos'),
                'variants' => $variants[$service->id]->map(fn (ServiceVehicleVariant $variant): array => [
                    'id' => $variant->id,
                    'vehicleType' => $variant->vehicleType->name,
                    'durationMinutes' => $variant->duration_minutes,
                    'priceCentavos' => $variant->price_centavos,
                ])->values()->all(),
            ])->values()->all();
    }

    private static function clock(string $time): string
    {
        return CarbonImmutable::createFromFormat('H:i:s', strlen($time) === 5 ? $time.':00' : $time)->format('g:i A');
    }
}
