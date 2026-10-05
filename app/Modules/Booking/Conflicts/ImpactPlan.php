<?php

namespace App\Modules\Booking\Conflicts;

/**
 * The deterministic whole-change plan for the future bookings a scheduling
 * change disrupts. Bookings that still fit are not listed. The fingerprint
 * identifies the plan exactly, so a confirmation can only be applied to the
 * very outcome the Owner reviewed.
 */
final readonly class ImpactPlan
{
    /** @param  list<ImpactItem>  $items */
    public function __construct(public array $items) {}

    public function isEmpty(): bool
    {
        return $this->items === [];
    }

    public function affected(): int
    {
        return count($this->items);
    }

    public function reassigned(): int
    {
        return count(array_filter($this->items, fn (ImpactItem $item): bool => $item->outcome === ImpactItem::REASSIGNED));
    }

    public function conflicts(): int
    {
        return count(array_filter($this->items, fn (ImpactItem $item): bool => $item->outcome === ImpactItem::CONFLICT));
    }

    public function fingerprint(): string
    {
        return hash('sha256', json_encode(array_map(
            fn (ImpactItem $item): array => [$item->booking->id, $item->outcome, $item->cause, $item->fromResourceId, $item->toResourceId],
            $this->items,
        ), JSON_THROW_ON_ERROR));
    }
}
