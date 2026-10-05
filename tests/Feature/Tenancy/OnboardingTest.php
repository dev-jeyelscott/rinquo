<?php

use App\Modules\Tenancy\Models\AuditEvent;
use App\Modules\Tenancy\Models\Branch;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Tenant;

test('guests cannot reach onboarding', function () {
    $this->get(route('owner.onboarding'))->assertRedirect(route('owner.auth.login'));
    $this->post(route('owner.onboarding.store'), ['name' => 'X', 'slug' => 'xyz', 'branch_name' => 'Main'])
        ->assertRedirect(route('owner.auth.login'));
    expect(Organization::query()->count())->toBe(0);
});

test('a new owner without an organization is sent to onboarding', function () {
    $user = Tenant::user();

    $this->actingAs($user)->get(route('owner.home'))->assertRedirect(route('owner.onboarding'));
    $this->actingAs($user)->withoutVite()->get(route('owner.onboarding'))
        ->assertInertia(fn (Assert $page) => $page->component('owner/onboarding')->where('timezone', 'Asia/Manila'));
});

test('onboarding atomically creates the organization, its only branch, the owner membership and an audit event', function () {
    $user = Tenant::user();

    $response = $this->actingAs($user)->post(route('owner.onboarding.store'), [
        'name' => 'Shine Auto Spa', 'slug' => 'Shine-Auto', 'branch_name' => 'Main branch',
    ]);

    $organization = Organization::query()->sole();
    $response->assertRedirect(route('owner.settings.profile', $organization));
    expect($organization->slug)->toBe('shine-auto')
        ->and($organization->published_at)->toBeNull()
        ->and($organization->branch->timezone)->toBe('Asia/Manila')
        ->and(Branch::query()->count())->toBe(1)
        ->and(Membership::query()->sole()->only(['organization_id', 'user_id', 'role']))
        ->toBe(['organization_id' => $organization->id, 'user_id' => $user->id, 'role' => 'owner'])
        ->and(AuditEvent::query()->sole()->action)->toBe('organization.created');
});

test('the owner is returned to their organization after signing in again', function () {
    [$user, $organization] = Tenant::organization();

    $this->actingAs($user)->get(route('owner.home'))->assertRedirect(route('owner.settings.profile', $organization));
    $this->actingAs($user)->get(route('owner.onboarding'))->assertRedirect(route('owner.home'));
});

test('a failed onboarding leaves no rows behind', function () {
    $user = Tenant::user();
    Event::listen('eloquent.creating: '.Membership::class, fn () => throw new RuntimeException('boom'));

    try {
        $this->actingAs($user)->withoutExceptionHandling()->post(route('owner.onboarding.store'), [
            'name' => 'Shine', 'slug' => 'shine', 'branch_name' => 'Main',
        ]);
    } catch (RuntimeException) {
    }

    expect(Organization::query()->count())->toBe(0)
        ->and(Branch::query()->count())->toBe(0)
        ->and(AuditEvent::query()->count())->toBe(0);
});

test('slugs must be unique, well formed and not reserved', function (string $slug, bool $valid) {
    Tenant::organization('taken');
    $user = Tenant::user('new@example.test');

    $response = $this->actingAs($user)->post(route('owner.onboarding.store'), ['name' => 'N', 'slug' => $slug, 'branch_name' => 'M']);

    $valid ? $response->assertSessionHasNoErrors() : $response->assertSessionHasErrors('slug');
})->with([
    'free' => ['fresh-shop', true],
    'taken' => ['taken', false],
    'taken in another case' => ['TAKEN', false],
    'spaces' => ['not valid', false],
    'leading hyphen' => ['-bad', false],
    'double hyphen' => ['a--b', false],
    'too short' => ['ab', false],
    'reserved' => ['admin', false],
]);

test('an owner cannot create a second organization', function () {
    [$user] = Tenant::organization();

    $this->actingAs($user)->post(route('owner.onboarding.store'), ['name' => 'Two', 'slug' => 'second', 'branch_name' => 'M'])
        ->assertSessionHasErrors('name');
    expect(Organization::query()->count())->toBe(1);
});

test('the database allows exactly one branch per organization', function () {
    [, $organization] = Tenant::organization();

    expect(fn () => $organization->branch()->create(['name' => 'Second']))->toThrow(UniqueConstraintViolationException::class);
});
