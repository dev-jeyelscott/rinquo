<?php

namespace App\Modules\Tenancy\Models;

use App\Modules\Scheduling\Models\AddOn;
use App\Modules\Scheduling\Models\BookingPolicy;
use App\Modules\Scheduling\Models\PhysicalResource;
use App\Modules\Scheduling\Models\ResourceType;
use App\Modules\Scheduling\Models\Service;
use App\Modules\Scheduling\Models\ServiceVehicleVariant;
use App\Modules\Scheduling\Models\VehicleType;
use App\Modules\Tenancy\Policies\OrganizationPolicy;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Attributes\UsePolicy;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

/**
 * The tenant root. Every tenant-owned record carries organization_id.
 *
 * @property int $id
 * @property string $name
 * @property string $slug
 * @property ?string $tagline
 * @property ?string $description
 * @property string $brand_color
 * @property ?CarbonImmutable $published_at
 */
#[UsePolicy(OrganizationPolicy::class)]
class Organization extends Model
{
    protected $fillable = ['name', 'slug', 'tagline', 'description', 'brand_color', 'directory_opted_in'];

    protected function casts(): array
    {
        return ['published_at' => 'immutable_datetime', 'directory_opted_in' => 'boolean'];
    }

    public function isPublished(): bool
    {
        return $this->published_at !== null;
    }

    /** @return HasOne<Branch, $this> */
    public function branch(): HasOne
    {
        return $this->hasOne(Branch::class);
    }

    /** @return HasOne<BookingPolicy, $this> */
    public function bookingPolicy(): HasOne
    {
        return $this->hasOne(BookingPolicy::class);
    }

    /** @return HasMany<Membership, $this> */
    public function memberships(): HasMany
    {
        return $this->hasMany(Membership::class);
    }

    /** @return HasMany<OrganizationMedia, $this> */
    public function media(): HasMany
    {
        return $this->hasMany(OrganizationMedia::class);
    }

    /** @return HasMany<VehicleType, $this> */
    public function vehicleTypes(): HasMany
    {
        return $this->hasMany(VehicleType::class);
    }

    /** @return HasMany<Service, $this> */
    public function services(): HasMany
    {
        return $this->hasMany(Service::class);
    }

    /** @return HasMany<AddOn, $this> */
    public function addOns(): HasMany
    {
        return $this->hasMany(AddOn::class);
    }

    /** @return HasMany<ResourceType, $this> */
    public function resourceTypes(): HasMany
    {
        return $this->hasMany(ResourceType::class);
    }

    /** @return HasMany<PhysicalResource, $this> */
    public function physicalResources(): HasMany
    {
        return $this->hasMany(PhysicalResource::class);
    }

    /** @return HasMany<ServiceVehicleVariant, $this> */
    public function variants(): HasMany
    {
        return $this->hasMany(ServiceVehicleVariant::class);
    }
}
