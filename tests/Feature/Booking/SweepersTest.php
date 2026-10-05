<?php

use App\Modules\Booking\Actions\ExpireBookings;
use App\Modules\Booking\Actions\SendBookingReminders;
use App\Modules\Booking\Mail\BookingReminderMail;
use App\Modules\Booking\Mail\BookingRequestExpiredMail;
use App\Modules\Booking\Models\Booking;
use App\Modules\Booking\Models\Hold;
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

test('a reminder is sent exactly once across repeated runs', function () {
    $shop = Shop::make();
    // Confirmed two days ago for tomorrow 07:00 (23 hours away); now is Monday 08:00.
    $booking = $shop->booking('2026-10-06 07:00', attributes: ['confirmed_at' => now()->subDays(2)]);

    expect(app(SendBookingReminders::class)->handle())->toBe(1);
    expect(app(SendBookingReminders::class)->handle())->toBe(0);
    $this->artisan('bookings:send-reminders')->assertSuccessful();

    Mail::assertQueued(BookingReminderMail::class, 1);
    expect($booking->fresh()->reminder_sent_at)->not->toBeNull();
});

test('reminders skip bookings outside the window, confirmed inside it, unconfirmed or already started', function () {
    $shop = Shop::make(capacity: 9);
    $shop->booking('2026-10-08 10:00', attributes: ['confirmed_at' => now()->subDays(2)]);            // starts in > 24 h
    $shop->booking('2026-10-06 07:30', attributes: ['confirmed_at' => now()->subMinutes(10)]);        // confirmed inside the window
    $shop->booking('2026-10-06 11:00', Booking::PENDING_APPROVAL);                                    // not confirmed
    $shop->booking('2026-10-06 12:00', Booking::DECLINED);                                            // declined
    $shop->booking('2026-10-05 07:00', attributes: ['confirmed_at' => now()->subDays(2)]);            // already started

    expect(app(SendBookingReminders::class)->handle())->toBe(0);
    Mail::assertNotQueued(BookingReminderMail::class);
});

test('both sweepers are scheduled every minute without overlapping', function () {
    $events = collect(app(Schedule::class)->events())->filter(fn ($event) => str_contains($event->command, 'bookings:'));

    expect($events)->toHaveCount(2)
        ->and($events->every(fn ($event) => $event->expression === '* * * * *' && $event->withoutOverlapping))->toBeTrue();
});
