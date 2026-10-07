<?php

namespace App\Modules\Platform\Actions;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Auth\RecoveryCodes;
use App\Modules\Platform\Mail\SecurityNoticeMail;
use App\Modules\Platform\Models\PlatformAdmin;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

final class RegenerateRecoveryCodes
{
    public function __construct(private readonly RecoveryCodes $codes) {}

    /** @return list<string> the new plaintext codes, to be shown exactly once */
    public function handle(PlatformAdmin $admin, string $event = 'recovery_codes.regenerated'): array
    {
        $codes = DB::transaction(function () use ($admin, $event): array {
            $codes = $this->codes->regenerate($admin);
            PlatformAudit::record($event, 'success', $admin, 'platform_admin', $admin->id);

            return $codes;
        });

        Mail::to($admin->email)->send(new SecurityNoticeMail('Recovery codes were generated for your platform account.'));

        return $codes;
    }
}
