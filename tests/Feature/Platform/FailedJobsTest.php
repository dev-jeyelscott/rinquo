<?php

use App\Modules\Platform\Models\AuditEvent;
use App\Modules\Platform\Models\JobRetry;
use App\Modules\Subscription\Jobs\ProcessWebhookEvent;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Platform;

beforeEach(function () {
    $this->withoutVite();
    $this->admin = Platform::admin();
    $this->as = fn () => $this->actingAs($this->admin, 'platform')->withSession(Platform::session($this->admin));
});

function failJob(string $class, string $secret = 'SECRET-PAYLOAD-VALUE'): string
{
    $uuid = (string) Str::uuid();
    DB::table('failed_jobs')->insert([
        'uuid' => $uuid, 'connection' => 'database', 'queue' => 'default',
        'payload' => json_encode(['uuid' => $uuid, 'displayName' => $class, 'job' => 'Illuminate\\Queue\\CallQueuedHandler@call', 'data' => ['commandName' => $class, 'command' => serialize(new ProcessWebhookEvent(1))], 'pii' => $secret.'@example.test']),
        'exception' => 'RuntimeException: connection to redis://user:hunter2@host failed in /app/Secret.php:12'."\n#0 stack trace with ".$secret,
        'failed_at' => now(),
    ]);

    return $uuid;
}

test('failed jobs are listed through a redacted projection', function () {
    failJob(ProcessWebhookEvent::class);
    failJob('App\\Modules\\Booking\\Jobs\\SomethingElse');

    $response = ($this->as)()->get(route('platform.failed-jobs'))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('platform/failed-jobs')->has('jobs', 2)->where('total', 2));
    $body = $response->getContent();

    expect($body)->not->toContain('SECRET-PAYLOAD-VALUE')->not->toContain('hunter2')->not->toContain('redis://')->not->toContain('/app/Secret.php')->not->toContain('stack trace')
        ->and($body)->toContain('RuntimeException');
});

test('only allowlisted job classes are retryable and unknown or unsafe jobs stay visible', function () {
    $safe = failJob(ProcessWebhookEvent::class);
    $unsafe = failJob('App\\Modules\\Booking\\Jobs\\SomethingElse');

    ($this->as)()->get(route('platform.failed-jobs'))->assertInertia(fn (Assert $page) => $page
        ->where('jobs', fn ($jobs) => collect($jobs)->firstWhere('uuid', $safe)['retryable'] === true && collect($jobs)->firstWhere('uuid', $unsafe)['retryable'] === false));

    ($this->as)()->post(route('platform.failed-jobs.retry', $unsafe), Platform::stepUp($this->admin))->assertSessionHasErrors('job');
    expect(DB::table('failed_jobs')->where('uuid', $unsafe)->exists())->toBeTrue()
        ->and(DB::table('jobs')->count())->toBe(0)
        ->and(AuditEvent::query()->where('event', 'failed_job.retry')->where('result', 'denied')->exists())->toBeTrue();
});

test('retry requires step-up and an existing job', function () {
    $safe = failJob(ProcessWebhookEvent::class);

    ($this->as)()->post(route('platform.failed-jobs.retry', $safe))->assertSessionHasErrors(['current_password', 'otp_code']);
    ($this->as)()->post(route('platform.failed-jobs.retry', (string) Str::uuid()), Platform::stepUp($this->admin))->assertSessionHasErrors('job');

    expect(DB::table('jobs')->count())->toBe(0)->and(JobRetry::query()->count())->toBe(0);
});

test('an eligible job is requeued once, audited, and a second attempt finds nothing to retry', function () {
    $safe = failJob(ProcessWebhookEvent::class);

    ($this->as)()->post(route('platform.failed-jobs.retry', $safe), Platform::stepUp($this->admin))->assertSessionHasNoErrors();
    ($this->as)()->post(route('platform.failed-jobs.retry', $safe), Platform::stepUp($this->admin))->assertSessionHasErrors('job');

    expect(DB::table('jobs')->count())->toBe(1)
        ->and(JobRetry::query()->sole())->toMatchArray(['job_uuid' => $safe, 'status' => JobRetry::QUEUED, 'job_class' => ProcessWebhookEvent::class])
        ->and(AuditEvent::query()->where('event', 'failed_job.retry')->pluck('result')->all())->toBe(['claimed', 'queued']);
});

test('a concurrent claim is a single winner at the database', function () {
    $safe = failJob(ProcessWebhookEvent::class);
    $claim = fn () => JobRetry::query()->create([
        'job_uuid' => $safe, 'job_class' => ProcessWebhookEvent::class, 'queue' => 'default', 'platform_admin_id' => $this->admin->id,
        'status' => JobRetry::CLAIMED, 'failed_at' => now(),
    ]);

    $claim();
    expect($claim)->toThrow(UniqueConstraintViolationException::class);
});

test('a queue outage leaves the job listed and the claim marked failed so it can be retried again', function () {
    $safe = failJob(ProcessWebhookEvent::class);
    DB::table('failed_jobs')->where('uuid', $safe)->update(['connection' => 'nonexistent-connection']);

    ($this->as)()->post(route('platform.failed-jobs.retry', $safe), Platform::stepUp($this->admin))->assertSessionHasErrors('job');

    expect(DB::table('failed_jobs')->where('uuid', $safe)->exists())->toBeTrue()
        ->and(JobRetry::query()->sole()->status)->toBe(JobRetry::DISPATCH_FAILED);
});

test('tenant users and guests cannot reach failed jobs', function () {
    $safe = failJob(ProcessWebhookEvent::class);

    $this->get(route('platform.failed-jobs'))->assertRedirect(route('platform.login'));
    $this->post(route('platform.failed-jobs.retry', $safe))->assertRedirect(route('platform.login'));
});
