<?php

namespace App\Console\Commands;

use App\Support\Diagnostics\FoundationSmokeBroadcast;
use App\Support\Diagnostics\FoundationSmokeJob;
use App\Support\Diagnostics\FoundationSmokeMail;
use Closure;
use Illuminate\Console\Command;
use Illuminate\Contracts\Events\Dispatcher;
use Illuminate\Database\DatabaseManager;
use Illuminate\Redis\RedisManager;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Sleep;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/**
 * Proves every foundation dependency works end to end. Output names the
 * failing check and exception class only; it never prints configuration
 * values, hosts or credentials.
 */
final class FoundationSmokeCommand extends Command
{
    /**
     * @var string
     */
    protected $signature = 'foundation:smoke
        {--mail-to= : Also send a smoke email to this address (Mailtrap inbox in development)}
        {--queue-timeout=20 : Seconds to wait for a queue worker to process the smoke job (1-120)}';

    /**
     * @var string
     */
    protected $description = 'Check PostgreSQL, Redis, queue worker, Reverb, object storage and (optionally) mail';

    public function handle(DatabaseManager $database, RedisManager $redis, Dispatcher $events): int
    {
        $mailTo = $this->option('mail-to');
        $queueTimeout = filter_var($this->option('queue-timeout'), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 120],
        ]);

        if ($mailTo !== null && Validator::make(['mail_to' => $mailTo], ['mail_to' => ['required', 'email:rfc']])->fails()) {
            $this->components->error('The --mail-to option must be a valid email address.');

            return self::FAILURE;
        }

        if ($queueTimeout === false) {
            $this->components->error('The --queue-timeout option must be an integer between 1 and 120.');

            return self::FAILURE;
        }

        $token = (string) Str::uuid();

        /** @var array<string, Closure(): string> $checks */
        $checks = [
            'database' => function () use ($database): string {
                $database->connection()->select('select 1');

                return 'connection "'.$database->getDefaultConnection().'"';
            },
            'redis' => function () use ($redis): string {
                foreach (['default', 'cache'] as $connection) {
                    $redis->connection($connection)->ping();
                }

                return 'connections "default", "cache"';
            },
            'queue' => fn (): string => $this->checkQueue($token, $queueTimeout),
            'broadcast' => function () use ($events, $token): string {
                $events->dispatch(new FoundationSmokeBroadcast($token));

                return 'channel "'.FoundationSmokeBroadcast::CHANNEL.'"';
            },
            'storage' => fn (): string => $this->checkStorage($token),
        ];

        if (is_string($mailTo)) {
            $checks['mail'] = function () use ($mailTo, $token): string {
                Mail::to($mailTo)->send(new FoundationSmokeMail($token));

                return 'mailer "'.config('mail.default').'"';
            };
        }

        $rows = [];
        $passed = true;

        foreach ($checks as $name => $check) {
            try {
                $rows[] = [$name, 'ok', $check()];
            } catch (Throwable $exception) {
                $passed = false;
                $rows[] = [$name, 'fail', $exception::class];

                Log::warning('Foundation smoke check failed.', [
                    'check' => $name,
                    'exception' => $exception::class,
                ]);
            }
        }

        $this->table(['Check', 'Result', 'Detail'], $rows);

        if (! $passed) {
            $this->components->error('One or more foundation checks failed.');

            return self::FAILURE;
        }

        $this->components->info('All foundation checks passed.');

        return self::SUCCESS;
    }

    private function checkQueue(string $token, int $timeoutSeconds): string
    {
        $key = FoundationSmokeJob::markerKey($token);
        $connection = (string) config('queue.default');

        Bus::dispatch((new FoundationSmokeJob($token))->onConnection($connection));

        $deadline = microtime(true) + $timeoutSeconds;

        while (! Cache::has($key)) {
            if (microtime(true) >= $deadline) {
                throw new RuntimeException('Timed out waiting for a queue worker.');
            }

            Sleep::for(250)->milliseconds();
        }

        Cache::forget($key);

        return 'processed via "'.$connection.'"';
    }

    private function checkStorage(string $token): string
    {
        $disk = Storage::disk();
        $path = 'diagnostics/smoke-'.$token.'.txt';
        $contents = 'foundation smoke '.$token;

        if ($disk->put($path, $contents) === false) {
            throw new RuntimeException('Object storage write failed.');
        }

        try {
            if ($disk->get($path) !== $contents) {
                throw new RuntimeException('Object storage read returned unexpected contents.');
            }
        } finally {
            $disk->delete($path);
        }

        return 'disk "'.config('filesystems.default').'"';
    }
}
