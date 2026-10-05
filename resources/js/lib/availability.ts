import type { AvailabilityReason } from '@/types/owner';

const LABELS: Record<AvailabilityReason, string> = {
    service_inactive: 'The service is inactive or archived.',
    vehicle_type_inactive: 'The vehicle type is inactive or archived.',
    variant_inactive: 'This variant is inactive.',
    missing_consumption:
        'No resource consumption is set, so this combination cannot be booked.',
    resource_type_inactive: 'A required resource type is inactive or archived.',
    insufficient_capacity:
        'No single active resource can hold the units this variant needs.',
    no_service_window:
        'No service window overlaps business hours for long enough.',
    no_business_hours: 'No business hours are set.',
};

export function reasonLabel(reason: string): string {
    return LABELS[reason as AvailabilityReason] ?? reason;
}
