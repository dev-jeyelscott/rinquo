<?php

use App\Modules\Booking\Actions\ExpireBookings;
use App\Modules\Booking\Actions\SendBookingReminders;
use App\Modules\Booking\Mail\BookingReminderMail;
use App\Modules\Booking\Mail\BookingRequestExpiredMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Support\Facades\Mail;
use Tests\Support\Shop;

beforeEach(function () {
    Mail::fake();
});

test('the sweeper expires stale holds and pending requests, tells the customer once and is idempotent', function () {
    $shop = Shop::make(capacity: 1);
    $live = $shop->hold('2026-10-06 09:00');
    $stale = $shop->hold('2026-10-06 11:00', attributes: ['expires_at' => now()->subMinute()]);
    $pending = $shop->booking('2026-10-06 13:00', Booking::PENDING_APPROVAL, attributes: ['pending_expires_at' => now()->subMinute()]);
    $stillPending = $shop->booking('2026-10-06 15:00', Booking::PENDING_APPROVAL);

    $this->artisan('bookings:expire')->assertSuccessful();

    expect($live->fresh()->status)->toBe(Hold::ACTIVE)
        ->and($stale->fresh()->status)->toBe(Hold::EXPIRED)
        ->and($pending->fresh()->status)->toBe(Booking::EXPIRED)
        ->and($pending->fresh()->expired_at)->not->toBeNull()
        ->and($stillPending->fresh()->status)->toBe(Booking::PENDING_APPROVAL);
    Mail::assertQueued(BookingRequestExpiredMail::class, 1);
    Mail::assertQueued(BookingRequestExpiredMail::class, fn ($mail) => $mail->hasTo($pending->contact_email));

    // A second run changes nothing and sends nothing more.
    $this->artisan('bookings:expire')->assertSuccessful();
    Mail::assertQueued(BookingRequestExpiredMail::class, 1);
    expect(app(ExpireBookings::class)->handle())->toBe(['holds' => 0, 'requests' => 0]);
});

test('the sweeper only touches its own stale rows and frees capacity for new bookings', function () {
    $shop = Shop::make(capacity: 1);
    $shop->booking('2026-10-06 09:00', Booking::PENDING_APPROVAL, attributes: ['pending_expires_at' => now()->addMinutes(5)]);
    $this->travel(10)->minutes();

    expect(app(ExpireBookings::class)->handle())->toBe(['holds' => 0, 'requests' => 1]);
    expect(Booking::query()->sole()->status)->toBe(Booking::EXPIRED);
});

test('a reminder is sent exactly once, 30 minutes before the start, across repeated runs', function () {
    $shop = Shop::make();
    // Confirmed two days ago for 08:25 today; now is Monday 08:00.
    $booking = $shop->booking('2026-10-05 08:25', attributes: ['confirmed_at' => now()->subDays(2)]);

    expect(app(SendBookingReminders::class)->handle())->toBe(1);
    expect(app(SendBookingReminders::class)->handle())->toBe(0);
    $this->artisan('bookings:send-reminders')->assertSuccessful();

    Mail::assertQueued(BookingReminderMail::class, 1);
    expect($booking->fresh()->reminder_sent_at)->not->toBeNull();
});

test('the reminder states the start time in the branch timezone', function () {
    $shop = Shop::make();
    $shop->booking('2026-10-05 08:25', attributes: ['confirmed_at' => now()->subDays(2)]);

    app(SendBookingReminders::class)->handle();

    Mail::assertQueued(BookingReminderMail::class, function (BookingReminderMail $mail) {
        $html = $mail->render();

        return str_contains($html, 'starts at 8:25 AM (Philippine time)');
    });
});

test('there is no 24 hour reminder, only one inside 30 minutes of the start', function () {
    $shop = Shop::make(capacity: 9);
    $shop->booking('2026-10-06 07:00', attributes: ['confirmed_at' => now()->subDays(2)]);            // 23 hours away
    $shop->booking('2026-10-05 08:45', attributes: ['confirmed_at' => now()->subDays(2)]);            // 45 minutes away

    expect(app(SendBookingReminders::class)->handle())->toBe(0);
    Mail::assertNotQueued(BookingReminderMail::class);

    $this->travel(15)->minutes();     // the 08:45 booking is now exactly 30 minutes away
    expect(app(SendBookingReminders::class)->handle())->toBe(1);
    expect(config('rinquo.booking.reminder_minutes_before'))->toBe(30)
        ->and(config('rinquo.booking.reminder_hours_before'))->toBeNull();
});

test('reminders skip bookings confirmed inside the window, unconfirmed, no longer scheduled or already started', function () {
    $shop = Shop::make(capacity: 9);
    $shop->booking('2026-10-05 08:20', attributes: ['confirmed_at' => now()->subMinutes(10)]);        // confirmed inside the window
    $shop->booking('2026-10-05 08:15', Booking::PENDING_APPROVAL);                                    // not confirmed
    $shop->booking('2026-10-05 08:10', Booking::DECLINED);                                            // declined
    $shop->booking('2026-10-05 08:05', attributes: ['confirmed_at' => now()->subDays(2), 'operational_state' => Booking::CHECKED_IN, 'checked_in_at' => now()]); // arrived
    $shop->booking('2026-10-04 07:00', attributes: ['confirmed_at' => now()->subDays(2)]);            // already started

    expect(app(SendBookingReminders::class)->handle())->toBe(0);
    Mail::assertNotQueued(BookingReminderMail::class);
});

test('expected start equals the booked start', function () {
    $booking = Shop::make()->booking('2026-10-05 09:00');

    expect($booking->expectedStartAt()->equalTo($booking->scheduled_start_at))->toBeTrue();
});

test('the reset migration clears only upcoming scheduled confirmed reminders beyond 30 minutes and is idempotent', function () {
    $shop = Shop::make(capacity: 9);
    $sent = ['confirmed_at' => now()->subDays(2), 'reminder_sent_at' => now()->subHours(1)];
    // The migration compares against the database clock, which test time travel does not move.
    $real = fn (string $modify) => CarbonImmutable::createFromTimestamp(time(), 'Asia/Manila')->modify($modify)->format('Y-m-d H:i');
    $future = $shop->booking($real('+1 day'), attributes: $sent);
    $soon = $shop->booking($real('+20 minutes'), attributes: $sent);
    $started = $shop->booking($real('-1 hour'), attributes: $sent);

    $migration = require base_path('database/migrations/2026_10_16_000001_reset_reminders_sent_under_24h_rule.php');
    $migration->up();
    $migration->up();

    expect($future->fresh()->reminder_sent_at)->toBeNull()
        ->and($soon->fresh()->reminder_sent_at)->not->toBeNull()
        ->and($started->fresh()->reminder_sent_at)->not->toBeNull();
});

test('both sweepers are scheduled every minute without overlapping', function () {
    $events = collect(app(Schedule::class)->events())->filter(fn ($event) => str_contains($event->command, 'bookings:'));

    expect($events)->toHaveCount(2)
        ->and($events->every(fn ($event) => $event->expression === '* * * * *' && $event->withoutOverlapping))->toBeTrue();
});
