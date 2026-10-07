<?php

namespace App\Modules\Platform\Models;

use App\Modules\Platform\Mail\PasswordResetMail;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Authenticatable;
use Illuminate\Auth\Passwords\CanResetPassword;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Contracts\Auth\CanResetPassword as CanResetPasswordContract;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Mail;

/**
 * A platform administrator. A separate identity from tenant and customer users: it never
 * shares a table, guard, session cookie or credential with them.
 *
 * @property int $id
 * @property string $email
 * @property string $name
 * @property string $status
 * @property int $session_generation
 * @property string $password
 * @property ?CarbonImmutable $last_login_at
 * @property ?CarbonImmutable $password_changed_at
 * @property ?CarbonImmutable $disabled_at
 * @property ?string $totp_secret
 * @property ?CarbonImmutable $totp_confirmed_at
 * @property int $totp_last_step
 */
class PlatformAdmin extends Model implements AuthenticatableContract, CanResetPasswordContract
{
    use Authenticatable;
    use CanResetPassword;

    public const ACTIVE = 'active';

    public const DISABLED = 'disabled';

    protected $fillable = ['email', 'name', 'password'];

    protected $hidden = ['password', 'totp_secret', 'remember_token'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',
            'totp_secret' => 'encrypted',
            'totp_confirmed_at' => 'immutable_datetime',
            'password_changed_at' => 'immutable_datetime',
            'last_login_at' => 'immutable_datetime',
            'disabled_at' => 'immutable_datetime',
        ];
    }

    public function isActive(): bool
    {
        return $this->status === self::ACTIVE;
    }

    public function hasConfirmedFactor(): bool
    {
        return $this->totp_secret !== null && $this->totp_confirmed_at !== null;
    }

    /** @return HasMany<RecoveryCode, $this> */
    public function recoveryCodes(): HasMany
    {
        return $this->hasMany(RecoveryCode::class, 'platform_admin_id');
    }

    public static function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }

    /** The reset link is mailed, not queued: the token must never sit in a queue payload. */
    public function sendPasswordResetNotification($token): void
    {
        Mail::to($this->email)->send(new PasswordResetMail(route('platform.password.reset', ['token' => $token, 'email' => $this->email])));
    }
}
