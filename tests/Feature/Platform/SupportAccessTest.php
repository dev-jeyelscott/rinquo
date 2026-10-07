<?php

use App\Modules\Platform\Models\AuditEvent;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Platform\Models\SupportSession;
use App\Modules\Tenancy\Models\AuditEvent as TenantAudit;
use App\Modules\Tenancy\Models\Membership;
use App\Modules\Tenancy\Models\Organization;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Platform;
use Tests\Support\Shop;
use Tests\Support\Tenant;

beforeEach(function () {
    $this->withoutVite();
    $this->admin = Platform::admin();
    $this->as = fn (?PlatformAdmin $a = null) => $this->actingAs($a ?? $this->admin, 'platform')->withSession(Platform::session($a ?? $this->admin));
    [$this->owner, $this->org] = Tenant::organization('shine');
    $this->staff = Tenant::user('staff@example.test');
    Membership::query()->create(['organization_id' => $this->org->id, 'user_id' => $this->staff->id, 'role' => Membership::STAFF]);
});

function startSupport($test, ?int $target = null, array $override = [])
{
    return ($test->as)()->post(route('platform.organizations.support.start', $test->org->id), array_merge([
        'target_user_id' => $target ?? $test->owner->id, 'reason' => 'Customer cannot see their services', 'reference' => 'SUP-1042',
    ], Platform::stepUp($test->admin), $override));
}

test('starting support needs step-up, a reason and a reference', function () {
    ($this->as)()->post(route('platform.organizations.support.start', $this->org->id), ['target_user_id' => $this->owner->id, 'reason' => 'Customer cannot see services', 'reference' => 'SUP-1'])
        ->assertSessionHasErrors(['current_password', 'otp_code']);
    startSupport($this, override: ['reason' => 'short'])->assertSessionHasErrors('reason');
    startSupport($this, override: ['reference' => ''])->assertSessionHasErrors('reference');

    expect(SupportSession::query()->count())->toBe(0);
});

test('a started session is bound to one organization and target, lasts 30 minutes, and is audited', function () {
    $response = startSupport($this);
    $session = SupportSession::query()->sole();

    $response->assertRedirect(route('platform.support.overview', $session->id));
    expect($session->organization_id)->toBe($this->org->id)
        ->and($session->target_user_id)->toBe($this->owner->id)
        ->and($session->platform_admin_id)->toBe($this->admin->id)
        ->and($session->reference)->toBe('SUP-1042')
        ->and((int) $session->started_at->diffInMinutes($session->expires_at))->toBe(30);
    expect(AuditEvent::query()->where('event', 'support.started')->sole()->metadata)->toMatchArray(['organization_id' => $this->org->id, 'target_user_id' => $this->owner->id]);
});

test('the database refuses a support session longer than 30 minutes', function () {
    expect(fn () => DB::table('support_sessions')->insert([
        'id' => (string) Str::uuid(), 'platform_admin_id' => $this->admin->id, 'organization_id' => $this->org->id, 'target_user_id' => $this->owner->id,
        'reason' => 'x', 'reference' => 'x', 'started_at' => now(), 'expires_at' => now()->addMinutes(31),
    ]))->toThrow(QueryException::class);
});

test('customers, non-members, inactive members and members of another organization are never targets', function () {
    $customer = Tenant::user('customer@example.test');
    [$otherOwner] = Tenant::organization('other');
    Membership::query()->where('user_id', $this->staff->id)->update(['is_active' => false]);

    foreach ([$customer->id, $otherOwner->id, $this->staff->id, 999999] as $target) {
        startSupport($this, $target)->assertSessionHasErrors('target_user_id');
    }
    expect(SupportSession::query()->count())->toBe(0);
});

test('an admin has at most one live session', function () {
    startSupport($this);
    startSupport($this, $this->staff->id)->assertSessionHasErrors('target_user_id');

    expect(SupportSession::query()->count())->toBe(1);
});

test('the overview applies the target member policy: staff do not see owner-only detail', function () {
    startSupport($this, $this->staff->id);
    $session = SupportSession::query()->sole();

    ($this->as)()->get(route('platform.support.overview', $session->id))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->component('platform/support/overview')->where('ownerDetail', null)->where('organization.name', 'Shine')
            ->where('platform.support.targetRole', 'staff')->where('platform.support.reference', 'SUP-1042'));
});

test('an owner target sees owner detail and every view is audited before the response', function () {
    startSupport($this);
    $session = SupportSession::query()->sole();

    ($this->as)()->get(route('platform.support.overview', $session->id))->assertOk()
        ->assertInertia(fn (Assert $page) => $page->has('ownerDetail.readiness')->has('ownerDetail.entitlement'));
    ($this->as)()->get(route('platform.support.booking-requests', $session->id))->assertOk();

    $views = AuditEvent::query()->where('event', 'support.view')->get();
    expect($views)->toHaveCount(2)
        ->and($views->first()->metadata['support_session_id'])->toBe($session->id)
        ->and($views->first()->metadata)->not->toHaveKeys(['query', 'body']);
});

test('every mutating method is refused before the controller and audited, with no tenant effect', function () {
    startSupport($this);
    $session = SupportSession::query()->sole();
    $tenantAudits = TenantAudit::query()->count();
    $name = $this->org->name;

    foreach (['post', 'put', 'patch', 'delete'] as $method) {
        foreach (['', '/booking-requests', '/settings/profile', '/billing/renewal', '/closure'] as $path) {
            ($this->as)()->{$method}('/platform/support/'.$session->id.$path, ['name' => 'Hacked'])->assertForbidden();
        }
    }

    expect(Organization::query()->find($this->org->id)->name)->toBe($name)
        ->and(TenantAudit::query()->count())->toBe($tenantAudits)
        ->and(AuditEvent::query()->where('event', 'support.attempt')->where('result', 'blocked')->count())->toBe(20);
});

test('paths outside the read allowlist, including exports, are refused and audited', function () {
    startSupport($this);
    $session = SupportSession::query()->sole();

    foreach (['/export', '/settings/profile', '/bookings.csv', '/billing'] as $path) {
        ($this->as)()->get('/platform/support/'.$session->id.$path)->assertNotFound();
    }

    expect(AuditEvent::query()->where('event', 'support.attempt')->where('metadata->reason_code', 'not_allowlisted')->count())->toBe(4)
        ->and(AuditEvent::query()->where('event', 'support.view')->count())->toBe(0);
});

test('another admin cannot use or end someone else\'s session', function () {
    startSupport($this);
    $session = SupportSession::query()->sole();
    $other = Platform::admin('other@example.test');

    ($this->as)($other)->get(route('platform.support.overview', $session->id))->assertNotFound();
    ($this->as)($other)->post(route('platform.support.exit', $session->id), [])->assertNotFound();
    expect($session->fresh()->ended_at)->toBeNull();
});

test('a tampered or unknown session id is refused', function () {
    ($this->as)()->get('/platform/support/'.(string) Str::uuid())->assertNotFound();
    ($this->as)()->get('/platform/support/not-a-uuid')->assertNotFound();
});

test('a session expires after 30 minutes and cannot be extended', function () {
    startSupport($this);
    $session = SupportSession::query()->sole();

    $this->travel(31)->minutes();
    ($this->as)()->withSession(Platform::session($this->admin))->get(route('platform.support.overview', $session->id))
        ->assertRedirect(route('platform.organizations.show', $this->org->id));

    expect($session->fresh()->end_reason)->toBe('expired');
});

test('exiting ends access immediately', function () {
    startSupport($this);
    $session = SupportSession::query()->sole();

    ($this->as)()->post(route('platform.support.exit', $session->id), [])->assertRedirect(route('platform.organizations.show', $this->org->id));
    ($this->as)()->get(route('platform.support.overview', $session->id))->assertRedirect(route('platform.organizations.show', $this->org->id));

    expect($session->fresh()->end_reason)->toBe('exited')
        ->and(AuditEvent::query()->where('event', 'support.ended')->count())->toBe(1);
});

test('disabling the admin ends access on the next request', function () {
    startSupport($this);
    $session = SupportSession::query()->sole();
    $this->admin->forceFill(['status' => PlatformAdmin::DISABLED])->save();

    ($this->as)()->get(route('platform.support.overview', $session->id))->assertRedirect(route('platform.login'));
});

test('losing the target membership ends the session', function () {
    startSupport($this, $this->staff->id);
    $session = SupportSession::query()->sole();
    Membership::query()->where('user_id', $this->staff->id)->update(['is_active' => false]);

    ($this->as)()->get(route('platform.support.overview', $session->id))->assertForbidden();
    expect($session->fresh()->end_reason)->toBe('target_invalid');
});

test('support views never carry customer contact details', function () {
    $shop = Shop::make('glow');
    $shop->booking('2026-10-06 10:00', 'pending_approval', attributes: ['pending_expires_at' => now()->addHour()]);
    ($this->as)()->post(route('platform.organizations.support.start', $shop->organization->id), [
        'target_user_id' => $shop->member('owner')->id, 'reason' => 'Looking at pending requests', 'reference' => 'SUP-2',
    ] + Platform::stepUp($this->admin));
    $session = SupportSession::query()->latest('started_at')->firstOrFail();

    $body = ($this->as)()->get(route('platform.support.booking-requests', $session->id))->assertOk()->getContent();

    expect($body)->not->toContain('contact_email')->not->toContain('contact_phone')->not->toContain('customerEmail')->not->toContain('vehicle_plate')->not->toContain('customer_notes');
});

test('organization search is paginated, literal and never lists customers', function () {
    foreach (range(1, 25) as $i) {
        Tenant::organization('shop-'.$i);
    }

    ($this->as)()->get(route('platform.organizations'))->assertInertia(fn (Assert $page) => $page->has('organizations', 20)->where('pagination.nextUrl', fn ($url) => $url !== null));
    ($this->as)()->get(route('platform.organizations', ['search' => '%']))->assertInertia(fn (Assert $page) => $page->has('organizations', 0));
    ($this->as)()->get(route('platform.organizations.show', $this->org->id))->assertInertia(fn (Assert $page) => $page->has('members', 2)->where('members.0.role', 'owner'));
});
