<?php

namespace App\Modules\Customer\Actions;

use App\Modules\Customer\Mail\CustomerEmailChangedMail;
use App\Modules\Customer\Models\CustomerEmailChangeChallenge;
use App\Modules\Identity\Models\User;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/** A browser-bound proof of control over a new customer email address. */
final class ChangeCustomerEmail
{
    private const GENERIC = 'That code is invalid or has expired. Request a new code.';

    public function request(User $user, string $email, string $ip): string
    {
        $email = User::normalizeEmail($email);
        if ($email === $user->email) {
            throw ValidationException::withMessages(['email' => 'Enter a different email address.']);
        }
        if (User::query()->where('email', $email)->exists()) {
            throw ValidationException::withMessages(['email' => 'That email address is already in use.']);
        }

        $this->hit('customer-email-change:'.$user->id, 5, 3600, 'email');
        $this->hit('customer-email-change-ip:'.$ip, 20, 3600, 'email');
        $token = Str::random(64);
        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $challenge = CustomerEmailChangeChallenge::query()->create([
            'user_id' => $user->id, 'new_email' => $email,
            'token_hash' => hash('sha256', $token),
            'code_hash' => $this->hash($email, $code), 'sent_at' => now(),
            'expires_at' => now()->addMinutes((int) config('rinquo.otp.expires_minutes')),
        ]);

        try {
            Mail::raw("Your Rinquo email-change code is {$code}. It expires in ".config('rinquo.otp.expires_minutes').' minutes.', function ($mail) use ($email): void {
                $mail->to($email)->subject('Confirm your new Rinquo email');
            });
        } catch (Throwable $exception) {
            $challenge->forceFill(['consumed_at' => now()])->save();
            report($exception);
            throw ValidationException::withMessages(['email' => 'We could not send the code. Please try again.']);
        }

        return $token;
    }

    public function verify(User $user, ?string $token, string $code, string $ip): void
    {
        $this->hit('customer-email-change-verify-ip:'.$ip, (int) config('rinquo.otp.verify_per_ip'), 600, 'code');
        if ($token === null || $token === '') {
            throw ValidationException::withMessages(['code' => self::GENERIC]);
        }

        DB::transaction(function () use ($user, $token, $code): void {
            /** @var CustomerEmailChangeChallenge|null $challenge */
            $challenge = CustomerEmailChangeChallenge::query()->where('user_id', $user->id)
                ->where('token_hash', hash('sha256', $token))->lockForUpdate()->first();
            if ($challenge === null || ! $challenge->isUsable() || $challenge->failed_attempts >= (int) config('rinquo.otp.max_failed_attempts')) {
                throw ValidationException::withMessages(['code' => self::GENERIC]);
            }
            if (! hash_equals($challenge->code_hash, $this->hash($challenge->new_email, $code))) {
                $challenge->increment('failed_attempts');
                throw ValidationException::withMessages(['code' => self::GENERIC]);
            }
            if (User::query()->where('email', $challenge->new_email)->whereKeyNot($user->id)->exists()) {
                throw ValidationException::withMessages(['code' => 'That email address is already in use.']);
            }

            $oldEmail = $user->email;
            try {
                $user->forceFill(['email' => $challenge->new_email, 'email_verified_at' => now()])->save();
            } catch (UniqueConstraintViolationException) {
                throw ValidationException::withMessages(['code' => 'That email address is already in use.']);
            }
            $challenge->forceFill(['consumed_at' => now()])->save();
            DB::afterCommit(function () use ($oldEmail, $user): void {
                try {
                    Mail::to($oldEmail)->send(new CustomerEmailChangedMail($user->email));
                } catch (Throwable $exception) {
                    report($exception);
                }
            });
        });
    }

    private function hash(string $email, string $code): string
    {
        return hash_hmac('sha256', $email.'|'.$code, (string) config('app.key'));
    }

    private function hit(string $key, int $max, int $decay, string $field): void
    {
        if (RateLimiter::tooManyAttempts($key, $max)) {
            throw ValidationException::withMessages([$field => 'Too many attempts. Please try again later.']);
        }
        RateLimiter::hit($key, $decay);
    }
}
