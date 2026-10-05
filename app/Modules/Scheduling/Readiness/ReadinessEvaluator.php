<?php

namespace App\Modules\Scheduling\Readiness;

use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\ServiceWindow;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Support\Collection;

/**
 * The single readiness rule set. The Owner checklist, the Publish action,
 * scheduling-critical mutations and public storefront visibility all call this
 * evaluator, so they cannot disagree. It reads the database every time and
 * never trusts a stored flag.
 *
 * A service/vehicle variant is available only when:
 * - its service, vehicle type and variant are active and not archived;
 * - it has at least one capacity-consumption rule, and every rule's resource
 *   type is active at the branch with an active physical resource whose own
 *   capacity can hold the rule's units (missing consumption is never "zero");
 * - one of its service's weekly windows overlaps branch opening hours on the
 *   same weekday for at least the variant's duration.
 */
final class ReadinessEvaluator
{
    public const REASON_SERVICE_INACTIVE = 'service_inactive';

    public const REASON_VEHICLE_INACTIVE = 'vehicle_type_inactive';

    public const REASON_VARIANT_INACTIVE = 'variant_inactive';

    public const REASON_NO_CONSUMPTION = 'missing_consumption';

    public const REASON_RESOURCE_TYPE_INACTIVE = 'resource_type_inactive';

    public const REASON_NO_CAPACITY = 'insufficient_capacity';

    public const REASON_NO_WINDOW = 'no_service_window';

    public const REASON_NO_HOURS = 'no_business_hours';

    public function evaluate(Organization $organization): ReadinessResult
    {
        $organization->load('branch');
        $branch = $organization->branch;
        $organizationId = $organization->id;

        $hours = BranchWeeklyHour::query()->where('organization_id', $organizationId)->get();
        /** @var array<int, list<BranchWeeklyHour>> $hoursByDay */
        $hoursByDay = $hours->groupBy('weekday')->map(fn ($rows) => $rows->values()->all())->all();

        $variants = $this->variantResults($organization, $hoursByDay);
        $availableCount = count(array_filter($variants, fn (array $variant): bool => $variant['available']));

        $profileComplete = trim((string) $organization->name) !== ''
            && trim((string) $organization->slug) !== ''
            && trim((string) $organization->tagline) !== ''
            && trim((string) $organization->description) !== ''
            && preg_match('/^#[0-9A-Fa-f]{6}$/', (string) $organization->brand_color) === 1;

        $branchComplete = $branch !== null
            && $branch->is_active
            && trim((string) $branch->address_line) !== ''
            && trim((string) $branch->city) !== ''
            && $branch->timezone === 'Asia/Manila';

        return new ReadinessResult([
            [
                'key' => 'profile',
                'label' => 'Public profile',
                'passed' => $profileComplete,
                'detail' => $profileComplete
                    ? 'Name, tagline, description and brand color are set.'
                    : 'Add a tagline, a description and a valid brand color.',
                'tab' => 'profile',
            ],
            [
                'key' => 'branch',
                'label' => 'Branch location',
                'passed' => $branchComplete,
                'detail' => $branchComplete
                    ? 'The active branch has an address and city.'
                    : 'Add the branch address and city.',
                'tab' => 'profile',
            ],
            [
                'key' => 'hours',
                'label' => 'Business hours',
                'passed' => $hours->isNotEmpty(),
                'detail' => $hours->isNotEmpty()
                    ? 'At least one weekly opening interval is set.'
                    : 'Add at least one open weekly interval.',
                'tab' => 'hours',
            ],
            [
                'key' => 'offering',
                'label' => 'Bookable service offering',
                'passed' => $availableCount > 0,
                'detail' => $availableCount > 0
                    ? "{$availableCount} service and vehicle combination(s) can be booked."
                    : 'Complete at least one service and vehicle combination with resource consumption and a service window.',
                'tab' => 'services',
            ],
        ], $variants);
    }

    /**
     * @param  array<int, list<BranchWeeklyHour>>  $hoursByDay
     * @return list<array{variant_id: int, service_id: int, service_name: string, vehicle_type_id: int, vehicle_type_name: string, available: bool, reasons: list<string>}>
     */
    private function variantResults(Organization $organization, array $hoursByDay): array
    {
        $organizationId = $organization->id;

        $services = Service::query()->where('organization_id', $organizationId)->get()->keyBy('id');
        $vehicleTypes = VehicleType::query()->where('organization_id', $organizationId)->get()->keyBy('id');
        $resourceTypes = ResourceType::query()->where('organization_id', $organizationId)->get()->keyBy('id');
        $largestCapacity = PhysicalResource::query()
            ->where('organization_id', $organizationId)
            ->where('is_active', true)
            ->whereNull('archived_at')
            ->get()
            ->groupBy('resource_type_id')
            ->map(fn ($resources) => (int) $resources->max('capacity'));
        $windowsByService = ServiceWindow::query()->where('organization_id', $organizationId)->get()->groupBy('service_id');

        $results = [];

        ServiceVehicleVariant::query()
            ->where('organization_id', $organizationId)
            ->whereNull('archived_at')
            ->with('consumptions')
            ->orderBy('id')
            ->get()
            ->each(function (ServiceVehicleVariant $variant) use (
                &$results, $services, $vehicleTypes, $resourceTypes, $largestCapacity, $windowsByService, $hoursByDay,
            ): void {
                $service = $services->get($variant->service_id);
                $vehicleType = $vehicleTypes->get($variant->vehicle_type_id);
                $reasons = [];

                if (! $service?->isUsable()) {
                    $reasons[] = self::REASON_SERVICE_INACTIVE;
                }
                if (! $vehicleType?->isUsable()) {
                    $reasons[] = self::REASON_VEHICLE_INACTIVE;
                }
                if (! $variant->isUsable()) {
                    $reasons[] = self::REASON_VARIANT_INACTIVE;
                }

                if ($variant->consumptions->isEmpty()) {
                    $reasons[] = self::REASON_NO_CONSUMPTION;
                }
                foreach ($variant->consumptions as $rule) {
                    $type = $resourceTypes->get($rule->resource_type_id);
                    if (! $type?->isUsable()) {
                        $reasons[] = self::REASON_RESOURCE_TYPE_INACTIVE;
                    } elseif ($rule->units <= 0 || ($largestCapacity->get($rule->resource_type_id) ?? 0) < $rule->units) {
                        $reasons[] = self::REASON_NO_CAPACITY;
                    }
                }

                if ($hoursByDay === []) {
                    $reasons[] = self::REASON_NO_HOURS;
                } elseif (! $this->hasFeasibleWindow($windowsByService->get($variant->service_id, collect()), $hoursByDay, $variant->duration_minutes)) {
                    $reasons[] = self::REASON_NO_WINDOW;
                }

                $results[] = [
                    'variant_id' => $variant->id,
                    'service_id' => $variant->service_id,
                    'service_name' => (string) $service?->name,
                    'vehicle_type_id' => $variant->vehicle_type_id,
                    'vehicle_type_name' => (string) $vehicleType?->name,
                    'available' => $reasons === [],
                    'reasons' => array_values(array_unique($reasons)),
                ];
            });

        return $results;
    }

    /**
     * @param  Collection<int, ServiceWindow>  $windows
     * @param  array<int, list<BranchWeeklyHour>>  $hoursByDay
     */
    private function hasFeasibleWindow($windows, array $hoursByDay, int $durationMinutes): bool
    {
        foreach ($windows as $window) {
            foreach ($hoursByDay[$window->weekday] ?? [] as $open) {
                $overlap = min(self::minutes($window->ends_at), self::minutes($open->closes_at))
                    - max(self::minutes($window->starts_at), self::minutes($open->opens_at));

                if ($overlap >= $durationMinutes && $overlap > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    /** Minutes since local midnight for a PostgreSQL time value (HH:MM[:SS]). */
    public static function minutes(string $time): int
    {
        [$hours, $minutes] = array_map('intval', explode(':', $time));

        return $hours * 60 + $minutes;
    }
}
