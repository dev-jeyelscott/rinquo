<?php

namespace App\Modules\Platform\Actions;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Models\PlatformAdmin;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

/**
 * Creates the very first platform administrator from the command line. It is a no-op when
 * any administrator exists, so running it twice (or on a populated system) changes nothing.
 * The password is passed in memory only; the second factor is enrolled at first sign-in.
 */
final class BootstrapAdmin
{
    /** @return bool true when an administrator was created */
    public function handle(string $email, string $name, string $password): bool
    {
        return DB::transaction(function () use ($email, $name, $password): bool {
            // Serialize concurrent bootstraps so two runs cannot both create a "first" admin.
            DB::select('select pg_advisory_xact_lock(?)', [8_000_001]);
            if (PlatformAdmin::query()->exists()) {
                return false;
            }

            $admin = PlatformAdmin::query()->create(['email' => PlatformAdmin::normalizeEmail($email), 'name' => $name, 'password' => $password]);
            $admin->forceFill(['password_changed_at' => CarbonImmutable::now()])->save();
            PlatformAudit::record('admin.bootstrapped', 'success', null, 'platform_admin', $admin->id);

            return true;
        });
    }
}
