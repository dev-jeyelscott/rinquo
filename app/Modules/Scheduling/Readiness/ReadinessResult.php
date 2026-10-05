<?php

namespace App\Modules\Scheduling\Readiness;

/**
 * Outcome of one readiness evaluation: the checklist the Owner sees and the
 * per-variant availability the storefront is filtered by. Built only by
 * {@see ReadinessEvaluator} from authoritative database state.
 *
 * @phpstan-type Item array{key: string, label: string, passed: bool, detail: string, tab: string}
 * @phpstan-type Variant array{
 *     variant_id: int, service_id: int, service_name: string, vehicle_type_id: int,
 *     vehicle_type_name: string, available: bool, reasons: list<string>
 * }
 */
final readonly class ReadinessResult
{
    /**
     * @param  list<Item>  $items
     * @param  list<Variant>  $variants
     */
    public function __construct(public array $items, public array $variants) {}

    public function isReady(): bool
    {
        foreach ($this->items as $item) {
            if (! $item['passed']) {
                return false;
            }
        }

        return true;
    }

    /** @return list<int> */
    public function availableVariantIds(): array
    {
        return array_values(array_map(
            fn (array $variant): int => $variant['variant_id'],
            array_filter($this->variants, fn (array $variant): bool => $variant['available']),
        ));
    }

    /** @return list<Item> */
    public function failingItems(): array
    {
        return array_values(array_filter($this->items, fn (array $item): bool => ! $item['passed']));
    }
}
