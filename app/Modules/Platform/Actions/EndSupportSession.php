<?php

namespace App\Modules\Platform\Actions;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\SupportSession;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final class EndSupportSession
{
    /** Idempotent: ending an already-ended session changes nothing. */
    public function handle(SupportSession $session, string $reason, ?PlatformAdmin $actor = null): void
    {
        DB::transaction(function () use ($session, $reason, $actor): void {
            $ended = SupportSession::query()->whereKey($session->id)->whereNull('ended_at')
                ->update(['ended_at' => CarbonImmutable::now(), 'end_reason' => $reason]);

            if ($ended === 1) {
                PlatformAudit::record('support.ended', 'success', $actor, 'support_session', $session->id, [
                    'organization_id' => $session->organization_id, 'support_session_id' => $session->id, 'cause' => $reason,
                ]);
            }
        });
    }
}
