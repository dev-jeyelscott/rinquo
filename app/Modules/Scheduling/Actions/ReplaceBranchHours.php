<?php

namespace App\Modules\Scheduling\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\BranchDateOverride;
use App\Modules\Scheduling\Models\BranchWeeklyHour;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Actions\ChangeOrganization;
use App\Modules\Tenancy\Models\Organization;

/** Replaces the branch's weekly hours and date overrides as one audited unit. */
final class ReplaceBranchHours
{
    public function __construct(private readonly ChangeOrganization $change) {}

    /**
     * @param  list<array{weekday: int, opens_at: string, closes_at: string}>  $weekly
     * @param  list<array{local_date: string, is_closed: bool, opens_at: string|null, closes_at: string|null}>  $overrides
     */
    public function handle(Organization $organization, User $actor, array $weekly, array $overrides): void
    {
        $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($weekly, $overrides): void {
            $branch = $locked->branch()->firstOrFail();

            $before = [
                'weekly' => BranchWeeklyHour::query()->where('branch_id', $branch->id)->orderBy('weekday')->orderBy('opens_at')
                    ->get(['weekday', 'opens_at', 'closes_at'])->toArray(),
                'overrides' => BranchDateOverride::query()->where('branch_id', $branch->id)->orderBy('local_date')
                    ->get(['local_date', 'is_closed', 'opens_at', 'closes_at'])->toArray(),
            ];

            BranchWeeklyHour::query()->where('branch_id', $branch->id)->delete();
            BranchDateOverride::query()->where('branch_id', $branch->id)->delete();

            $scope = ['organization_id' => $locked->id, 'branch_id' => $branch->id];
            foreach ($weekly as $row) {
                BranchWeeklyHour::query()->create($scope + $row);
            }
            foreach ($overrides as $row) {
                BranchDateOverride::query()->create($scope + $row);
            }

            $audit->record('branch.hours_replaced', 'branch', $branch->id, $before, ['weekly' => $weekly, 'overrides' => $overrides]);
        });
    }
}
