<?php

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Mail\LoginCodeMail;
use App\Modules\Identity\Models\OwnerLoginChallenge;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Throwable;

/**
 * Creates a challenge and emails the six-digit code.
 *
 * Responses never reveal whether an account exists. The raw code is generated
 * from a CSPRNG, stored only as an HMAC, and sent synchronously. If the mail
 * provider fails, the challenge is invalidated and a generic retryable error
 * is returned.
 */
final class RequestLoginCode
{
    /**
     * @return string The raw browser-bound challenge token to keep in the session.
     */
    public function handle(string $email, string $ip): string
    {
        $email = User::normalizeEmail($email);
        $config = (array) config('rinquo.otp');

        $this->hit('otp-request-email:'.hash('sha256', $email), (int) $config['request_per_email_per_hour'], 3600, 'email');
        $this->hit('otp-request-ip:'.$ip, (int) $config['request_per_ip_per_hour'], 3600, 'email');

        $cooldown = (int) $config['resend_cooldown_seconds'];
        $latest = OwnerLoginChallenge::query()->where('email', $email)->latest('sent_at')->first();

        if ($latest !== null && $latest->sent_at->addSeconds($cooldown)->isFuture()) {
            $wait = (int) max(1, now()->diffInSeconds($latest->sent_at->addSeconds($cooldown), true));

            throw ValidationException::withMessages(['email' => "Please wait {$wait} seconds before requesting another code."]);
        }

        $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
        $token = Str::random(64);

        $challenge = OwnerLoginChallenge::query()->create([
            'email' => $email,
            'token_hash' => hash('sha256', $token),
            'code_hash' => self::hashCode($email, $code),
            'sent_at' => now(),
            'expires_at' => now()->addMinutes((int) $config['expires_minutes']),
        ]);

        try {
            Mail::to($email)->send(new LoginCodeMail($code, (int) $config['expires_minutes']));
        } catch (Throwable $exception) {
            $challenge->forceFill(['consumed_at' => now()])->save();
            report($exception);

            throw ValidationException::withMessages(['email' => 'We could not send the code. Please try again.']);
        }

        return $token;
    }

    public static function hashCode(string $email, string $code): string
    {
        return hash_hmac('sha256', $email.'|'.$code, (string) config('app.key'));
    }

    private function hit(string $key, int $max, int $decaySeconds, string $field): void
    {
        if (RateLimiter::tooManyAttempts($key, $max)) {
            throw ValidationException::withMessages([$field => 'Too many requests. Please try again later.']);
        }

        RateLimiter::hit($key, $decaySeconds);
    }
}
