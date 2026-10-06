<?php

namespace App\Modules\Identity\Models;

use App\Modules\Customer\Models\CustomerProfile;
use App\Modules\Customer\Models\CustomerVehicle;
use App\Modules\Tenancy\Models\Membership;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Authenticatable;
use Illuminate\Contracts\Auth\Authenticatable as AuthenticatableContract;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * A verified email identity. Owners sign in with a one-time email code, so the
 * model has no password and no social-login or customer-identity behaviour.
 *
 * @property int $id
 * @property string $email
 * @property ?CarbonImmutable $email_verified_at
 */
class User extends Model implements AuthenticatableContract
{
    use Authenticatable;

    protected $fillable = ['email'];

    protected $hidden = ['remember_token'];

    protected function casts(): array
    {
        return ['email_verified_at' => 'immutable_datetime'];
    }

    /** There is no password credential. */
    public function getAuthPassword(): string
    {
        return '';
    }

    /** @return HasMany<Membership, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    public function customerProfile(): HasOne
    {
        return $this->hasOne(CustomerProfile::class);
    }

    public function customerVehicles(): HasMany
    {
        return $this->hasMany(CustomerVehicle::class);
    }

    public static function normalizeEmail(string $email): string
    {
        return mb_strtolower(trim($email));
    }
}
