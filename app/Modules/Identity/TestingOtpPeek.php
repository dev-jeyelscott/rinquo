<?php

namespace App\Modules\Identity;

use Illuminate\Mail\Events\MessageSent;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Route;

/**
 * Browser-test support: lets Playwright read the code that was just emailed.
 * Registered ONLY when APP_ENV is "testing"; in every other environment neither
 * the listener nor the route exists, so a real code can never be read back.
 */
final class TestingOtpPeek
{
    public static function register(): void
    {
        if (! app()->environment('testing')) {
            return;
        }

        Event::listen(MessageSent::class, function (MessageSent $event): void {
            if (! preg_match('/<strong>(\d{6})<\/strong>/', (string) $event->message->getHtmlBody(), $match)) {
                return;
            }

            foreach ($event->message->getTo() as $address) {
                Cache::put(self::key($address->getAddress()), $match[1], 300);
            }
        });

        Route::get('__testing/otp', fn () => response()->json([
            'code' => Cache::get(self::key(strtolower((string) request('email')))),
        ]))->name('testing.otp');
    }

    private static function key(string $email): string
    {
        return 'testing-otp:'.sha1(strtolower($email));
    }
}
