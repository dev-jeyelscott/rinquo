<?php

namespace App\Modules\Platform\Actions;

use App\Modules\Platform\Audit\PlatformAudit;
use App\Modules\Platform\Models\JobRetry;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Support\FailedJobs;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Retries exactly one failed job by id, and only when its class is on the explicit
 * allowlist. The claim is a unique row written (with the audit event) before the queue is
 * touched, so concurrent operators produce one winner and no network call happens inside
 * the transaction.
 */
final class RetryFailedJob
{
    public function __construct(private readonly FailedJobs $failedJobs) {}

    public function handle(PlatformAdmin $actor, string $uuid): void
    {
        $row = DB::table('failed_jobs')->where('uuid', $uuid)->first(['uuid', 'queue', 'payload', 'failed_at']);
        if ($row === null) {
            throw ValidationException::withMessages(['job' => 'This failed job no longer exists. It may already have been retried.']);
        }

        $class = $this->failedJobs->jobClass((string) $row->payload);
        if ($class === null || ! array_key_exists($class, (array) config('rinquo.platform.retryable_jobs'))) {
            PlatformAudit::record('failed_job.retry', 'denied', $actor, 'failed_job', $uuid, ['job_uuid' => $uuid, 'reason_code' => 'not_retryable']);
            throw ValidationException::withMessages(['job' => 'This job is not proven safe to run again and cannot be retried here.']);
        }

        try {
            $retry = DB::transaction(function () use ($actor, $row, $class): JobRetry {
                // The failed row must still exist at claim time: a retry that already completed removed it.
                if (! DB::table('failed_jobs')->where('uuid', $row->uuid)->lockForUpdate()->exists()) {
                    throw ValidationException::withMessages(['job' => 'This failed job no longer exists. It may already have been retried.']);
                }
                $retry = JobRetry::query()->create([
                    'job_uuid' => $row->uuid,
                    'job_class' => $class,
                    'queue' => $row->queue,
                    'platform_admin_id' => $actor->id,
                    'status' => JobRetry::CLAIMED,
                    'failed_at' => CarbonImmutable::parse((string) $row->failed_at, 'UTC'),
                ]);
                PlatformAudit::record('failed_job.retry', 'claimed', $actor, 'failed_job', $row->uuid, ['job_uuid' => $row->uuid, 'job_class' => $class, 'queue' => $row->queue]);

                return $retry;
            });
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['job' => 'This job is already being retried.']);
        }

        try {
            Artisan::call('queue:retry', ['id' => [$uuid]]);
        } catch (Throwable $e) {
            report($e);
            DB::transaction(function () use ($retry, $actor, $uuid): void {
                $retry->forceFill(['status' => JobRetry::DISPATCH_FAILED, 'settled_at' => CarbonImmutable::now()])->save();
                PlatformAudit::record('failed_job.retry', 'dispatch_failed', $actor, 'failed_job', $uuid, ['job_uuid' => $uuid]);
            });
            throw ValidationException::withMessages(['job' => 'The queue was unavailable, so the job was not retried. It is still listed; try again shortly.']);
        }

        DB::transaction(function () use ($retry, $actor, $uuid): void {
            $retry->forceFill(['status' => JobRetry::QUEUED, 'settled_at' => CarbonImmutable::now()])->save();
            PlatformAudit::record('failed_job.retry', 'queued', $actor, 'failed_job', $uuid, ['job_uuid' => $uuid]);
        });
    }
}
