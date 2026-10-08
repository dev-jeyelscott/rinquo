<?php

use App\Modules\Tenancy\Models\Membership;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Tenant;

test('the owner sees the settings index with the shared owner props', function () {
    [$owner, $organization] = Tenant::organization('shine');

    $this->actingAs($owner)->get(route('owner.settings.index', $organization))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('owner/settings/index')
            ->where('organization.id', $organization->id)
            ->where('organization.baseUrl', route('owner.settings.index', $organization, absolute: false))
            ->where('organization.billingUrl', route('owner.settings.billing', $organization, absolute: false))
            ->has('readiness.isReady')
            ->has('readiness.items')
            ->has('entitlement.state'));
});

test('the settings index keeps the existing section urls under the same base', function () {
    [$owner, $organization] = Tenant::organization('shine');

    $this->actingAs($owner)->get(route('owner.settings.profile', $organization))
        ->assertInertia(fn (Assert $page) => $page
            ->where('organization.baseUrl', '/owner/organizations/'.$organization->id.'/settings'));
});

test('staff, other tenants and guests cannot open the settings index', function () {
    [, $organization] = Tenant::organization('shine');
    $staff = Tenant::user('staff@example.test');
    Membership::query()->create(['organization_id' => $organization->id, 'user_id' => $staff->id, 'role' => Membership::STAFF]);
    [$intruder] = Tenant::organization('rival');
    $url = route('owner.settings.index', $organization);

    $this->actingAs($staff)->get($url)->assertForbidden();
    $this->actingAs($intruder)->get($url)->assertNotFound();
    auth()->logout();
    $this->get($url)->assertRedirect(route('owner.auth.login'));
});
