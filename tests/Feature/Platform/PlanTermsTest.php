<?php

use App\Modules\Platform\Models\AuditEvent;
use App\Modules\Platform\Models\PlanTermVersion;
use App\Modules\Platform\Models\PlatformAdmin;
use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\Subscription;
use App\Modules\Subscription\Support\PlanTerms;
use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Support\Billing;
use Tests\Support\Platform;
use Tests\Support\Tenant;

beforeEach(function () {
    $this->withoutVite();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Manila'));
    // Pin the deployment defaults: a developer's .env may override them.
    config(['rinquo.subscription.amount_centavos' => 99900, 'rinquo.subscription.trial_days' => 14, 'rinquo.subscription.grace_days' => 3]);
    $this->admin = Platform::admin();
    $this->as = fn () => $this->actingAs($this->admin, 'platform')->withSession(Platform::session($this->admin));
});

function publish($test, array $data = [])
{
    return ($test->as)()->post(route('platform.plan-terms.publish'), array_merge([
        'amount_centavos' => 129900, 'trial_days' => 14, 'grace_days' => 3,
        'effective_at' => now()->addDays(2)->toIso8601String(), 'reason' => 'Annual price review approved',
    ], Platform::stepUp($test->admin), $data));
}

test('with nothing published the deployment defaults apply, and the shipped grace default is the locked three days', function () {
    expect(PlanTerms::current())->toMatchObject(['graceDays' => 3, 'trialDays' => 14, 'amountCentavos' => 99900])
        ->and(file_get_contents(config_path('rinquo.php')))->toContain("env('RINQUO_GRACE_DAYS', 3)");
});

test('publishing needs step-up and valid, bounded values', function () {
    ($this->as)()->post(route('platform.plan-terms.publish'), ['amount_centavos' => 1])->assertSessionHasErrors(['current_password', 'otp_code']);

    foreach ([['amount_centavos' => 0], ['trial_days' => 0], ['grace_days' => 91], ['reason' => 'short'], ['effective_at' => 'not a date']] as $bad) {
        publish($this, $bad)->assertSessionHasErrors(array_key_first($bad));
    }
    expect(PlanTermVersion::query()->count())->toBe(0);
});

test('a published version is audited, effective-dated, and applies only from its effective time', function () {
    publish($this)->assertSessionHasNoErrors()->assertRedirect(route('platform.plan-terms'));

    $version = PlanTermVersion::query()->sole();
    expect($version->getAttribute('created_by_admin_id'))->toBe($this->admin->id)
        ->and(PlanTerms::current()->amountCentavos)->toBe(99900)
        ->and(PlanTerms::at(now()->addDays(3))->amountCentavos)->toBe(129900);
    expect(AuditEvent::query()->where('event', 'plan_terms.published')->sole()->metadata)->toMatchArray(['amount_centavos' => 129900, 'grace_days' => 3]);

    $this->travel(3)->days();
    expect(PlanTerms::current()->amountCentavos)->toBe(129900);
});

test('a version cannot take effect in the past or before the latest version', function () {
    publish($this, ['effective_at' => now()->subDay()->toIso8601String()])->assertSessionHasErrors('effective_at');
    publish($this)->assertSessionHasNoErrors();
    publish($this, ['effective_at' => now()->addDay()->toIso8601String()])->assertSessionHasErrors('effective_at');
    publish($this, ['effective_at' => now()->addDays(2)->toIso8601String()])->assertSessionHasErrors('effective_at');

    expect(PlanTermVersion::query()->count())->toBe(1);
});

test('versions are immutable in the database', function () {
    publish($this);
    $id = PlanTermVersion::query()->sole()->id;

    expect(fn () => DB::table('plan_term_versions')->where('id', $id)->update(['amount_centavos' => 1]))->toThrow(QueryException::class)
        ->and(fn () => DB::table('plan_term_versions')->where('id', $id)->delete())->toThrow(QueryException::class);
});

test('a future price changes later renewal requests only: issued requests and paid periods keep their snapshots', function () {
    Billing::fake();
    [$owner, $organization] = Tenant::organization();
    $subscriptionBefore = Subscription::query()->sole()->only(['trial_ends_at', 'grace_ends_at', 'paid_until']);

    $this->actingAs($owner)->post(route('owner.settings.billing.renewal', $organization))->assertSessionHasNoErrors();
    $issued = PaymentRequest::query()->sole();
    expect($issued->amount_centavos)->toBe(99900);

    publish($this)->assertSessionHasNoErrors();
    $this->travel(3)->days();

    $this->actingAs($owner)->post(route('owner.settings.billing.renewal', $organization))->assertSessionHasNoErrors();

    $requests = PaymentRequest::query()->orderBy('id')->get();
    expect($requests)->toHaveCount(2)
        ->and($requests[0]->amount_centavos)->toBe(99900)
        ->and($requests[1]->amount_centavos)->toBe(129900)
        ->and(Subscription::query()->sole()->only(['trial_ends_at', 'grace_ends_at', 'paid_until']))->toEqual($subscriptionBefore);
});

test('terms in the past stay reproducible after a later publication', function () {
    publish($this);
    $before = PlanTerms::at(now()->addHour());
    publish($this, ['effective_at' => now()->addDays(10)->toIso8601String(), 'amount_centavos' => 149900]);

    expect(PlanTerms::at(now()->addHour())->amountCentavos)->toBe($before->amountCentavos)
        ->and(PlanTerms::at(now()->addDays(11))->amountCentavos)->toBe(149900);
});

test('the plan page shows the current terms and history to an admin only', function () {
    publish($this);

    ($this->as)()->get(route('platform.plan-terms'))->assertInertia(fn (Assert $page) => $page->component('platform/plan-terms')->where('current.graceDays', 3)->has('history', 1));

    $this->actingAs(Tenant::user('someone@example.test'))->get(route('platform.plan-terms'))->assertRedirect(route('platform.login'));
});

test('a disabled admin cannot publish', function () {
    $admin = PlatformAdmin::query()->find($this->admin->id);
    $session = Platform::session($admin);
    $admin->forceFill(['status' => PlatformAdmin::DISABLED])->save();

    $this->actingAs($admin, 'platform')->withSession($session)->post(route('platform.plan-terms.publish'), [])->assertRedirect(route('platform.login'));
    expect(PlanTermVersion::query()->count())->toBe(0);
});

test('a non-UTC offset is stored as the matching UTC instant and audited consistently', function () {
    publish($this, ['effective_at' => '2026-12-03T09:00:00+08:00'])->assertSessionHasNoErrors();

    $stored = DB::table('plan_term_versions')->value('effective_at');
    expect(CarbonImmutable::parse($stored.'+00')->toIso8601String())->toBe('2026-12-03T01:00:00+00:00')
        ->and(PlanTermVersion::query()->sole()->effective_at->utc()->toIso8601String())->toBe('2026-12-03T01:00:00+00:00')
        ->and(AuditEvent::query()->where('event', 'plan_terms.published')->sole()->metadata['effective_at'])->toBe('2026-12-03T01:00:00+00:00');
});
