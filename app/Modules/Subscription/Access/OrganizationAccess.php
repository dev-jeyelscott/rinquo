<?php

namespace App\Modules\Subscription\Access;

use App\Modules\Tenancy\Models\OrganizationClosure;
use Carbon\CarbonImmutable;

/**
 * The side-effect-free answer to "what may this organization do now". It is
 * derived from snapshotted instants and the independent closure record; nothing
 * is stored. Existing bookings stay operable in every state: restriction and
 * closure stop new work and configuration, never existing bookings.
 */
final class OrganizationAccess
{
    public const TRIAL = 'trial';

    public const PAID = 'paid';

    public const GRACE = 'grace';

    public const RESTRICTED = 'restricted';

    public function __construct(
        /** trial | paid | grace | restricted (billing only; closure is separate). */
        public readonly string $entitlement,
        public readonly CarbonImmutable $at,
        public readonly ?CarbonImmutable $trialEndsAt,
        public readonly ?CarbonImmutable $paidUntil,
        public readonly ?CarbonImmutable $graceEndsAt,
        public readonly ?OrganizationClosure $closure,
    ) {}

    public function isClosed(): bool
    {
        return $this->closure !== null;
    }

    public function isRestricted(): bool
    {
        return $this->entitlement === self::RESTRICTED;
    }

    public function acceptsNewBookings(): bool
    {
        return ! $this->isRestricted() && ! $this->isClosed();
    }

    public function allowsConfigurationWrites(): bool
    {
        return $this->acceptsNewBookings();
    }

    public function allowsCustomerReschedule(): bool
    {
        return $this->acceptsNewBookings();
    }

    public function allowsExistingOperations(): bool
    {
        return true;
    }

    public function allowsCustomerCancellation(): bool
    {
        return true;
    }

    /** The one customer-safe sentence for why a shop is not taking new bookings, or null when it is. */
    public function newBookingBlockReason(): ?string
    {
        if ($this->acceptsNewBookings()) {
            return null;
        }

        return 'This shop is not taking new bookings right now. Existing bookings are not affected.';
    }
}
