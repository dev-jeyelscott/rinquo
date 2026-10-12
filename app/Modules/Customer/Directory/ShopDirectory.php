<?php

namespace App\Modules\Customer\Directory;

use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Readiness\ReadinessEvaluator;
use App\Modules\Subscription\Access\AccessResolver;
use App\Modules\Tenancy\Http\Storefront;
use App\Modules\Tenancy\Models\Organization;
use App\Modules\Tenancy\Models\OrganizationMedia;
use Illuminate\Support\Collection;

/**
 * The neutral customer directory read model (Decisions 74-79). A shop is listed
 * only while the Owner opted in, it is published, it can take new bookings and
 * the shared readiness evaluator passes. The name/city search narrows the
 * candidates in SQL before readiness runs, candidates stream in name order and
 * the scan stops as soon as one more than a page of eligible shops is found, so
 * an eligible shop is never dropped by truncating before readiness. Card facts
 * are batch-loaded for the page only and come from bookable variants; media is
 * served through the gated public shop media route, never as a storage URL.
 */
final class ShopDirectory
{
    public const LIMIT = 50;

    private const SERVICES_SHOWN = 3;

    private const DAYS = [1 => 'Mon', 2 => 'Tue', 3 => 'Wed', 4 => 'Thu', 5 => 'Fri', 6 => 'Sat', 7 => 'Sun'];

    public function __construct(private readonly ReadinessEvaluator $readiness, private readonly AccessResolver $access) {}

    /** @return array{shops: list<array<string, mixed>>, hasMore: bool} */
    public function search(string $query): array
    {
        /** @var array<int, array{organization: Organization, variants: list<int>}> $eligible */
        $eligible = [];
        $hasMore = false;

        $candidates = $this->access->scopeAcceptingNewBookings(Organization::query()->where('directory_opted_in', true)->whereNotNull('published_at'))
            ->when($query !== '', fn ($builder) => $builder->whereExists(fn ($branch) => $branch->selectRaw('1')->from('branches')
                ->whereColumn('branches.organization_id', 'organizations.id')
                ->whereRaw("concat(organizations.name, ' ', coalesce(branches.city, '')) ilike ? escape '\\'", ['%'.addcslashes($query, '%_\\').'%'])))
            ->with('branch')->orderBy('name')->orderBy('id')->lazy(100);

        foreach ($candidates as $organization) {
            $result = $this->readiness->evaluate($organization);
            if (! $result->isReady()) {
                continue;
            }
            if (count($eligible) === self::LIMIT) {
                $hasMore = true;
                break;
            }
            $eligible[$organization->id] = ['organization' => $organization, 'variants' => $result->availableVariantIds()];
        }

        return ['shops' => $this->cards($eligible), 'hasMore' => $hasMore];
    }

    /**
     * @param  array<int, array{organization: Organization, variants: list<int>}>  $eligible
     * @return list<array<string, mixed>>
     */
    private function cards(array $eligible): array
    {
        if ($eligible === []) {
            return [];
        }

        $ids = array_keys($eligible);
        $variants = ServiceVehicleVariant::query()->whereIn('organization_id', $ids)
            ->whereIn('id', array_merge(...array_column($eligible, 'variants')))
            ->get(['id', 'organization_id', 'service_id', 'price_centavos']);
        $services = Service::query()->whereIn('id', $variants->pluck('service_id')->unique())->orderBy('name')->get(['id', 'organization_id', 'name'])->groupBy('organization_id');
        $hours = BranchWeeklyHour::query()->whereIn('organization_id', $ids)->orderBy('weekday')->orderBy('opens_at')->get(['organization_id', 'weekday', 'opens_at', 'closes_at'])->groupBy('organization_id');
        $media = OrganizationMedia::query()->whereIn('organization_id', $ids)->active()->whereIn('kind', [OrganizationMedia::LOGO, OrganizationMedia::HERO])
            ->orderBy('sort_order')->orderBy('id')->get(['id', 'organization_id', 'kind', 'alt_text'])->groupBy('organization_id');
        $variants = $variants->groupBy('organization_id');

        $cards = [];
        foreach ($eligible as $id => ['organization' => $organization]) {
            /** @var Collection<int, OrganizationMedia> $shopMedia */
            $shopMedia = $media->get($id, collect());
            $image = function (string $kind) use ($shopMedia, $organization): ?array {
                $item = $shopMedia->firstWhere('kind', $kind);

                return $item === null ? null : ['url' => route('shops.media', [$organization->slug, $item->id], absolute: false), 'altText' => $item->alt_text];
            };
            $names = $services->get($id, collect())->pluck('name');
            $minimum = $variants->get($id, collect())->min('price_centavos');

            $cards[] = [
                'name' => $organization->name,
                'city' => $organization->branch?->city,
                'logo' => $image(OrganizationMedia::LOGO),
                'cover' => $image(OrganizationMedia::HERO),
                'services' => $names->take(self::SERVICES_SHOWN)->values()->all(),
                'moreServices' => max(0, $names->count() - self::SERVICES_SHOWN),
                'fromPriceCentavos' => $minimum === null ? null : (int) $minimum,
                'hours' => $this->hours($hours->get($id, collect())),
                'url' => route('shops.show', $organization->slug, absolute: false),
                'bookingUrl' => route('bookings.wizard', $organization->slug, absolute: false),
            ];
        }

        return $cards;
    }

    /**
     * Weekly opening hours as runs of consecutive days that share the same
     * intervals, for example "Mon–Sat · 8:00 AM–7:00 PM" or "Daily · ...".
     *
     * @param  Collection<int, BranchWeeklyHour>  $rows
     * @return list<string>
     */
    private function hours(Collection $rows): array
    {
        $byDay = [];
        foreach (self::DAYS as $weekday => $ignored) {
            $byDay[$weekday] = $rows->where('weekday', $weekday)
                ->map(fn (BranchWeeklyHour $row): string => Storefront::clock($row->opens_at).'–'.Storefront::clock($row->closes_at))
                ->implode(', ');
        }

        $runs = [];
        foreach ($byDay as $weekday => $label) {
            $last = array_key_last($runs);
            if ($last !== null && $runs[$last]['label'] === $label && $runs[$last]['to'] === $weekday - 1) {
                $runs[$last]['to'] = $weekday;
            } else {
                $runs[] = ['from' => $weekday, 'to' => $weekday, 'label' => $label];
            }
        }

        $open = array_values(array_filter($runs, fn (array $run): bool => $run['label'] !== ''));
        if (count($open) === 1 && $open[0]['from'] === 1 && $open[0]['to'] === 7) {
            return ['Daily · '.$open[0]['label']];
        }

        return array_map(fn (array $run): string => ($run['from'] === $run['to'] ? self::DAYS[$run['from']] : self::DAYS[$run['from']].'–'.self::DAYS[$run['to']]).' · '.$run['label'], $open);
    }
}
