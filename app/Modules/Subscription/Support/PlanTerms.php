<?php

namespace App\Modules\Subscription\Support;

use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/**
 * The single, validated seam for global plan terms. Callers never read the
 * config keys directly, so a later Platform Admin UI can replace the source
 * without touching entitlement or payment code.
 *
 * Amount, trial and grace come from the latest effective, immutable plan_term_versions
 * row published by a Platform Admin; until one exists, the deployment config supplies
 * them. Everything else (QR lifetime, tolerances, reminders) stays configuration.
 */
final class PlanTerms
{
    public const TIMEZONE = 'Asia/Manila';

    /** PayMongo accepts a QR lifetime of 60 to 9000 seconds. */
    public const QR_MIN_SECONDS = 60;

    public const QR_MAX_SECONDS = 9000;

    /** @param  list<int>  $reminderOffsetsDays */
    public function __construct(
        public readonly string $currency,
        public readonly int $amountCentavos,
        public readonly int $trialDays,
        public readonly int $graceDays,
        public readonly int $requestLifetimeHours,
        public readonly int $qrLifetimeSeconds,
        public readonly array $reminderOffsetsDays,
        public readonly int $signatureToleranceSeconds,
        public readonly int $closureRecoveryDays,
    ) {
        if ($currency !== 'PHP') {
            throw new InvalidArgumentException('The subscription currency must be PHP.');
        }
        if ($amountCentavos < 1 || $trialDays < 1 || $graceDays < 1 || $requestLifetimeHours < 1 || $closureRecoveryDays < 1) {
            throw new InvalidArgumentException('Subscription plan terms must be positive.');
        }
        if ($qrLifetimeSeconds < self::QR_MIN_SECONDS || $qrLifetimeSeconds > self::QR_MAX_SECONDS) {
            throw new InvalidArgumentException('The provider QR lifetime must be between 60 and 9000 seconds.');
        }
        if ($reminderOffsetsDays === [] || array_filter($reminderOffsetsDays, fn (int $day): bool => $day < 1) !== []) {
            throw new InvalidArgumentException('Reminder offsets must be positive days.');
        }
        if ($signatureToleranceSeconds < 1) {
            throw new InvalidArgumentException('The webhook signature tolerance must be positive.');
        }
    }

    public static function current(): self
    {
        return self::at(CarbonImmutable::now());
    }

    /** The terms in force at an instant, so a past period can be reproduced after a later publication. */
    public static function at(CarbonImmutable $instant): self
    {
        $config = (array) config('rinquo.subscription');
        $offsets = array_values(array_unique(array_map('intval', (array) $config['reminder_offsets_days'])));
        rsort($offsets);

        $version = DB::table('plan_term_versions')
            ->where('effective_at', '<=', $instant)
            ->orderByDesc('effective_at')
            ->first(['amount_centavos', 'trial_days', 'grace_days']);

        return new self(
            (string) $config['currency'],
            $version === null ? (int) $config['amount_centavos'] : (int) $version->amount_centavos,
            $version === null ? (int) $config['trial_days'] : (int) $version->trial_days,
            $version === null ? (int) $config['grace_days'] : (int) $version->grace_days,
            (int) $config['request_lifetime_hours'],
            (int) $config['qr_lifetime_seconds'],
            $offsets,
            (int) $config['signature_tolerance_seconds'],
            (int) $config['closure_recovery_days'],
        );
    }
}
