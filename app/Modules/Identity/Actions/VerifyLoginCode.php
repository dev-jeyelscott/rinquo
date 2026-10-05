<?php

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\OwnerLoginChallenge;
use App\Modules\Identity\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

/**
 * Verifies a code against the browser-bound challenge and returns the user.
 *
 * A challenge is single-use, expires, and tolerates a bounded number of wrong
 * guesses. Failed, expired and consumed challenges never authenticate.
 */
final class VerifyLoginCode
{
    private const GENERIC = 'That code is invalid or has expired. Request a new code.';

    public function handle(?string $token, string $code, string $ip): User
    {
        $config = (array) config('rinquo.otp');
        $ipKey = 'otp-verify-ip:'.$ip;

        if (RateLimiter::tooManyAttempts($ipKey, (int) $config['verify_per_ip'])) {
            throw ValidationException::withMessages(['code' => 'Too many attempts. Please try again later.']);
        }
        RateLimiter::hit($ipKey, 600);

        if ($token === null || $token === '') {
            throw ValidationException::withMessages(['code' => self::GENERIC]);
        }

        $user = DB::transaction(function () use ($token, $code, $config): ?User {
            $challenge = OwnerLoginChallenge::query()
                ->where('token_hash', hash('sha256', $token))
                ->lockForUpdate()
                ->first();

            if ($challenge === null || ! $challenge->isUsable()) {
                return null;
            }

            if ($challenge->failed_attempts >= (int) $config['max_failed_attempts']) {
                $challenge->forceFill(['consumed_at' => now()])->save();

                return null;
            }

            if (! hash_equals($challenge->code_hash, RequestLoginCode::hashCode($challenge->email, $code))) {
                $challenge->increment('failed_attempts');

                return null;
            }

            $challenge->forceFill(['consumed_at' => now()])->save();

            return $this->userFor($challenge->email);
        });

        if ($user === null) {
            throw ValidationException::withMessages(['code' => self::GENERIC]);
        }

        RateLimiter::clear($ipKey);

        return $user;
    }

    private function userFor(string $email): User
    {
        try {
            // Nested transaction = savepoint, so a unique violation does not abort the outer PostgreSQL transaction.
            $user = DB::transaction(fn (): User => User::query()->firstOrCreate(['email' => $email]));
        } catch (UniqueConstraintViolationException) {
            $user = User::query()->where('email', $email)->firstOrFail();
        }

        if ($user->email_verified_at === null) {
            $user->forceFill(['email_verified_at' => now()])->save();
        }

        return $user;
    }
}
