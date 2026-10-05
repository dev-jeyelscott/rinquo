<?php

namespace App\Modules\Booking\Support;

use Illuminate\Contracts\Session\Session;
use Illuminate\Support\Str;

/**
 * Browser-session state for the customer booking flow. One random token binds
 * the browser to its holds (only its SHA-256 is stored), and the email
 * verification state lives under booking_verification.* so it never mixes with
 * the Owner sign-in keys. The token survives session regeneration at sign-in.
 */
final class BookingSession
{
    private const TOKEN = 'booking.token';

    public const VERIFICATION_TOKEN = 'booking_verification.token';

    public const VERIFICATION_EMAIL = 'booking_verification.email';

    public const VERIFICATION_SENT_AT = 'booking_verification.sent_at';

    public function __construct(private readonly Session $session) {}

    /** The browser's hold-binding token, created on first use. */
    public function token(): string
    {
        $token = $this->session->get(self::TOKEN);

        if (! is_string($token) || $token === '') {
            $token = Str::random(64);
            $this->session->put(self::TOKEN, $token);
        }

        return $token;
    }

    /** The token only when one exists (never creates one), for lookups. */
    public function existingToken(): ?string
    {
        $token = $this->session->get(self::TOKEN);

        return is_string($token) && $token !== '' ? $token : null;
    }

    public function rememberVerification(string $challengeToken, string $email): void
    {
        $this->session->put([
            self::VERIFICATION_TOKEN => $challengeToken,
            self::VERIFICATION_EMAIL => $email,
            self::VERIFICATION_SENT_AT => now()->getTimestamp(),
        ]);
    }

    public function forgetVerification(): void
    {
        $this->session->forget([self::VERIFICATION_TOKEN, self::VERIFICATION_EMAIL, self::VERIFICATION_SENT_AT]);
    }

    /** @return array{step: 'details'|'code', email: ?string, resendInSeconds: int, codeLength: int, cooldownSeconds: int} */
    public function verificationState(bool $signedIn): array
    {
        $email = $this->session->get(self::VERIFICATION_EMAIL);
        $cooldown = (int) config('rinquo.otp.resend_cooldown_seconds');
        $sentAt = (int) $this->session->get(self::VERIFICATION_SENT_AT, 0);
        $inCodeStep = ! $signedIn && is_string($email) && $this->session->has(self::VERIFICATION_TOKEN);

        return [
            'step' => $inCodeStep ? 'code' : 'details',
            'email' => is_string($email) ? $email : null,
            'resendInSeconds' => $inCodeStep ? max(0, $sentAt + $cooldown - now()->getTimestamp()) : 0,
            'codeLength' => 6,
            'cooldownSeconds' => $cooldown,
        ];
    }

    public function challengeToken(): ?string
    {
        $token = $this->session->get(self::VERIFICATION_TOKEN);

        return is_string($token) ? $token : null;
    }
}
