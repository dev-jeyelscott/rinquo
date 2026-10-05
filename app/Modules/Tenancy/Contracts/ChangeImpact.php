<?php

namespace App\Modules\Tenancy\Contracts;

use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Models\Organization;

/**
 * What a scheduling-critical change must settle with future bookings before it
 * can commit. Implemented by the Booking module; called by ChangeOrganization
 * under the organization row lock, inside the change's transaction, after the
 * mutation ran. It either records the outcome or throws to roll the change back.
 */
interface ChangeImpact
{
    public function settle(Organization $locked, ?User $actor, AuditTrail $audit): void;
}
