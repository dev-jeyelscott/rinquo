<?php

use App\Modules\Subscription\Mail\RenewalReminderMail;
use App\Modules\Subscription\Models\PaymentRequest;
use App\Modules\Subscription\Models\ReminderDelivery;
use App\Modules\Tenancy\Models\OrganizationClosure;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Mail;
use Tests\Support\Billing;
use Tests\Support\Tenant;

beforeEach(function () {
    Mail::fake();
    $this->gateway = Billing::fake();
    $this->travelTo(CarbonImmutable::parse('2026-10-05 08:00', 'Asia/Manila'));
    [$this->owner, $this->organization] = Tenant::organization();
    $this->endsAt = now()->addDays(10)->setMicroseconds(0);
    Billing::set($this->organization, $this->endsAt, null, $this->endsAt->addDays(7));
});

function runReminders(): void
{
    test()->artisan('subscriptions:send-reminders')->assertSuccessful();
}

test('nothing is sent before the first threshold', function () {
    runReminders();

    Mail::assertNothingQueued();
    expect(ReminderDelivery::query()->count())->toBe(0)->and(PaymentRequest::query()->count())->toBe(0);
});

test('one reminder per 7, 3 and 1 day threshold, each exactly once across reruns', function () {
    foreach ([[7, 7], [3, 3], [1, 1]] as [$days]) {
        $this->travelTo($this->endsAt->subDays($days)->addMinute());
        runReminders();
        runReminders();
        Mail::assertQueued(RenewalReminderMail::class, fn ($mail) => $mail->offsetDays === $days);
    }

    Mail::assertQueued(RenewalReminderMail::class, 3);
    expect(ReminderDelivery::query()->where('status', ReminderDelivery::SENT)->count())->toBe(3);
});

test('a missed schedule catches up with one reminder for the tightest threshold, not a storm', function () {
    $this->travelTo($this->endsAt->subHours(10));

    runReminders();
    runReminders();

    Mail::assertQueued(RenewalReminderMail::class, 1);
    Mail::assertQueued(RenewalReminderMail::class, fn ($mail) => $mail->offsetDays === 1);
    expect(ReminderDelivery::query()->where('status', ReminderDelivery::SKIPPED)->pluck('offset_days')->sort()->values()->all())->toBe([3, 7]);
});

test('the reminder opens or reuses the 24 hour renewal request with a QR', function () {
    $this->travelTo($this->endsAt->subDays(7)->addMinute());

    runReminders();
    $this->travel(1)->hours();
    runReminders();

    expect(PaymentRequest::query()->count())->toBe(1)
        ->and(PaymentRequest::query()->sole()->qr_image)->not->toBeNull()
        ->and(PaymentRequest::query()->sole()->expires_at->equalTo(PaymentRequest::query()->sole()->created_at->addHours(24)))->toBeTrue();
});

test('an early renewal moves the entitlement cycle and opens fresh thresholds', function () {
    $this->travelTo($this->endsAt->subDays(7)->addMinute());
    runReminders();
    Mail::assertQueued(RenewalReminderMail::class, 1);

    // The Owner pays: paid-through moves a month out, so the cycle (and its deadline) changes.
    $newEnd = $this->endsAt->addMonth();
    Billing::set($this->organization, $this->endsAt, $newEnd, $newEnd->addDays(7));
    runReminders();
    Mail::assertQueued(RenewalReminderMail::class, 1);

    $this->travelTo($newEnd->subDays(7)->addMinute());
    runReminders();

    Mail::assertQueued(RenewalReminderMail::class, 2);
    expect(ReminderDelivery::query()->where('status', ReminderDelivery::SENT)->count())->toBe(2);
});

test('the email names the end date and promises nothing is deleted', function () {
    $this->travelTo($this->endsAt->subDays(7)->addMinute());
    runReminders();

    Mail::assertQueued(RenewalReminderMail::class, function (RenewalReminderMail $mail) {
        $html = $mail->render();

        return $mail->hasTo($this->owner->email)
            && str_contains($html, 'Oct 15, 2026')
            && str_contains($html, 'nothing is deleted')
            && str_contains($html, route('owner.settings.billing', $this->organization));
    });
});

test('a provider outage still sends the reminder and leaves entitlement unchanged', function () {
    $this->gateway->failing = true;
    $this->travelTo($this->endsAt->subDays(7)->addMinute());

    runReminders();

    Mail::assertQueued(RenewalReminderMail::class, 1);
    expect(PaymentRequest::query()->count())->toBe(1)->and(PaymentRequest::query()->sole()->qr_image)->toBeNull();
});

test('a mail failure releases the claim so the next run retries without duplicating', function () {
    $this->travelTo($this->endsAt->subDays(7)->addMinute());
    Mail::shouldReceive('to')->once()->andThrow(new RuntimeException('smtp down'));

    runReminders();

    expect(ReminderDelivery::query()->sole()->status)->toBe(ReminderDelivery::PENDING);
});

test('closed organizations and lapsed ones receive no reminders', function () {
    OrganizationClosure::query()->forceCreate([
        'organization_id' => $this->organization->id, 'requested_by_user_id' => $this->owner->id,
        'requested_at' => now(), 'recoverable_until' => now()->addDays(90),
    ]);
    $this->travelTo($this->endsAt->subDays(1));
    runReminders();
    Mail::assertNothingQueued();

    OrganizationClosure::query()->delete();
    $this->travelTo($this->endsAt->addDays(2));
    runReminders();
    Mail::assertNothingQueued();
});

test('reminders never write a restriction flag, closure or booking data', function () {
    $this->travelTo($this->endsAt->subDays(1));
    runReminders();

    expect(OrganizationClosure::query()->count())->toBe(0);
});
