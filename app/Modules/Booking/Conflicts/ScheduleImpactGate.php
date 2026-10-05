<?php

namespace App\Modules\Booking\Conflicts;

use App\Modules\Booking\Mail\SchedulingConflictStaffMail;
use App\Modules\Identity\Models\User;
use App\Modules\Tenancy\Actions\AuditTrail;
use App\Modules\Tenancy\Contracts\ChangeImpact;
use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Throwable;

/**
 * Preview-then-commit for scheduling changes. After the mutation ran inside the
 * locked transaction it plans the impact on future bookings from the resulting
 * configuration. No impact: the change simply commits. Impact without a token
 * minted for exactly this payload and this plan (or an explicit preview): it
 * throws {@see ScheduleImpactPending}, rolling the change back. With a valid
 * token it records reassignments and conflicts and tells staff. The server
 * recomputes everything; the client's counts and the token are only compared.
 */
final class ScheduleImpactGate implements ChangeImpact
{
    public function __construct(private readonly ImpactAnalyzer $analyzer, private readonly ConflictRecorder $recorder) {}

    public function settle(Organization $locked, ?User $actor, AuditTrail $audit): void
    {
        $now = CarbonImmutable::now();
        $plan = $this->analyzer->analyze($locked, $now);
        $request = request();
        $preview = $request->boolean('preview_impact');

        if ($plan->isEmpty() && ! $preview) {
            return;
        }

        $token = $this->token($request, $locked, $actor, $plan);
        if ($preview) {
            throw new ScheduleImpactPending(ImpactSummary::of($plan, $locked->id, $token, true));
        }

        $given = $request->input('impact_token');
        if (! is_string($given) || ! hash_equals($token, $given)) {
            throw new ScheduleImpactPending(ImpactSummary::of($plan, $locked->id, $token, false), stale: is_string($given));
        }

        $source = (string) (AuditEvent::query()->where('organization_id', $locked->id)->latest('id')->value('action') ?? 'scheduling.change');
        $conflicts = $this->recorder->persist($plan, $locked, $actor, $source, $audit, $now);
        if ($conflicts > 0) {
            $this->notifyStaff($locked, $conflicts);
        }
    }

    /** Binds the confirmation to organization, actor, request and the exact plan. */
    private function token(Request $request, Organization $organization, ?User $actor, ImpactPlan $plan): string
    {
        $payload = $request->except(['impact_token', 'preview_impact', '_token']);
        $payload = self::sorted($payload);
        $material = json_encode([$organization->id, $actor?->id, $request->method(), $request->path(), $payload, $plan->fingerprint()], JSON_PARTIAL_OUTPUT_ON_ERROR);

        return hash_hmac('sha256', (string) $material, (string) config('app.key'));
    }

    private static function sorted(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }
        $value = array_map(self::sorted(...), $value);
        if (! array_is_list($value)) {
            ksort($value);
        }

        return $value;
    }

    /** Staff hear about new conflicts immediately; the message carries counts only, never customer data. */
    private function notifyStaff(Organization $organization, int $conflicts): void
    {
        DB::afterCommit(function () use ($organization, $conflicts): void {
            try {
                $emails = Membership::query()->where('organization_id', $organization->id)->where('is_active', true)
                    ->join('users', 'users.id', '=', 'organization_memberships.user_id')->pluck('users.email');
                foreach ($emails as $email) {
                    Mail::to($email)->queue(new SchedulingConflictStaffMail($organization->id, $conflicts));
                }
            } catch (Throwable $exception) {
                report($exception);
            }
        });
    }
}
