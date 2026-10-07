<?php

namespace App\Modules\Platform\Support;

use Carbon\CarbonImmutable;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;

/**
 * A redacted read model over Laravel's failed_jobs table. The raw payload and exception
 * text are read only to extract an allowlisted class name; neither is ever returned.
 */
final class FailedJobs
{
    private const CLASS_PATTERN = '/^[A-Za-z_][A-Za-z0-9_\\\\]*$/';

    /** @return LengthAwarePaginator<int, array<string, mixed>> */
    public function page(int $perPage = 20): LengthAwarePaginator
    {
        $page = DB::table('failed_jobs')
            ->select(['uuid', 'queue', 'failed_at', 'payload', DB::raw('left(exception, 400) as exception_head')])
            ->orderByDesc('id')
            ->paginate($perPage);

        return $page->through(fn (object $row): array => $this->project($row));
    }

    /** @return array<string, mixed> */
    public function project(object $row): array
    {
        $class = $this->jobClass((string) data_get($row, 'payload'));
        $retryable = $class !== null && array_key_exists($class, (array) config('rinquo.platform.retryable_jobs'));

        return [
            'uuid' => (string) data_get($row, 'uuid'),
            'queue' => (string) data_get($row, 'queue'),
            'jobClass' => $class ?? 'Unknown job',
            'exceptionClass' => $this->exceptionClass((string) data_get($row, 'exception_head', '')),
            'failedAt' => CarbonImmutable::parse((string) data_get($row, 'failed_at'), 'UTC')->toIso8601String(),
            'retryable' => $retryable,
            'retryNote' => $retryable ? config('rinquo.platform.retryable_jobs')[$class] : 'Not proven safe to run again. Follow the runbook.',
        ];
    }

    public function jobClass(string $payload): ?string
    {
        $decoded = json_decode($payload, true);
        $class = is_array($decoded) ? ($decoded['displayName'] ?? null) : null;

        return is_string($class) && preg_match(self::CLASS_PATTERN, $class) === 1 ? $class : null;
    }

    private function exceptionClass(string $head): string
    {
        return preg_match('/^([A-Za-z_][A-Za-z0-9_\\\\]*)/', $head, $m) === 1 ? $m[1] : 'Unknown error';
    }
}
