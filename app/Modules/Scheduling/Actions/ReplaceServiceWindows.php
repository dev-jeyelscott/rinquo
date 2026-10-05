<?php

namespace App\Modules\Scheduling\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceWindow;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Actions\ChangeOrganization;
use App\Modules\Tenancy\Models\Organization;

final class ReplaceServiceWindows
{
    public function __construct(private readonly ChangeOrganization $change) {}

    /** @param  list<array{weekday: int, starts_at: string, ends_at: string}>  $windows */
    public function handle(Organization $organization, User $actor, Service $service, array $windows): void
    {
        $this->change->handle($organization, $actor, function (Organization $locked, AuditTrail $audit) use ($service, $windows): void {
            $before = ServiceWindow::query()->where('service_id', $service->id)->orderBy('weekday')->orderBy('starts_at')
                ->get(['weekday', 'starts_at', 'ends_at'])->toArray();

            ServiceWindow::query()->where('service_id', $service->id)->delete();
            foreach ($windows as $window) {
                ServiceWindow::query()->create(['organization_id' => $locked->id, 'service_id' => $service->id] + $window);
            }

            $audit->record('service.windows_replaced', 'service', $service->id, ['windows' => $before], ['windows' => $windows]);
        }, assessImpact: true);
    }
}
