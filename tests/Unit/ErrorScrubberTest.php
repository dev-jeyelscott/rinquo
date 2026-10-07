<?php

use App\Support\Telemetry\ErrorScrubber;
use Illuminate\Support\Facades\Context;
use Sentry\Breadcrumb;
use Sentry\Event;
use Sentry\EventType;
use Sentry\ExceptionDataBag;
use Sentry\Severity;
use Sentry\UserDataBag;

function dirtyEvent(): Event
{
    $event = Event::createEvent();
    $event->setLevel(Severity::error());
    $event->setRelease('release-abc123');
    $event->setEnvironment('staging');
    $event->setTransaction('/owner/organizations/{organization}/settings/profile');
    $event->setRequest([
        'url' => 'https://rinquo.example/owner/organizations/7?token=SECRET-URL-TOKEN',
        'method' => 'POST',
        'headers' => ['Authorization' => ['Bearer SECRET-BEARER'], 'Cookie' => ['rinquo-session=SECRET-COOKIE']],
        'cookies' => ['rinquo-session' => 'SECRET-COOKIE'],
        'data' => ['password' => 'SECRET-PASSWORD', 'otp_code' => '123456', 'recovery_code' => 'SECRET-RECOVERY'],
        'query_string' => 'email=customer@example.test',
    ]);
    $event->setUser(UserDataBag::createFromUserIdentifier('customer@example.test'));
    $event->setExtra(['provider_payload' => '{"card":"4242"}', 'private_url' => 'https://s3.example/private/obj?X-Amz-Signature=SECRET-SIG']);
    $event->setContext('request_body', ['body' => 'SECRET-BODY']);
    $event->setBreadcrumb([new Breadcrumb(Breadcrumb::LEVEL_INFO, Breadcrumb::TYPE_DEFAULT, 'sql', 'select * from users where email = ?')]);
    $event->setTags(['route' => 'wrong', 'password' => 'SECRET-TAG', 'job_class' => 'App\\Jobs\\X', 'customer_email' => 'customer@example.test']);
    $event->setExceptions([new ExceptionDataBag(new RuntimeException('SQLSTATE[23505]: insert into users (email) values (customer@example.test) at https://s3.example/obj?X-Amz-Signature=SECRET-SIG'))]);

    return $event;
}

test('an error report carries only allowlisted metadata', function () {
    Context::add('request_id', 'req-123');
    $clean = ErrorScrubber::scrub(dirtyEvent());

    expect($clean)->toBeInstanceOf(Event::class)
        ->and($clean->getRelease())->toBe('release-abc123')
        ->and($clean->getEnvironment())->toBe('staging')
        ->and($clean->getTransaction())->toBe('/owner/organizations/{organization}/settings/profile')
        ->and($clean->getTags())->toBe(['job_class' => 'App\\Jobs\\X', 'correlation_id' => 'req-123'])
        ->and($clean->getExceptions())->toHaveCount(1)
        ->and($clean->getExceptions()[0]->getType())->toBe(RuntimeException::class);
});

test('no request data, user, extra, context, breadcrumb or exception message survives', function () {
    $clean = ErrorScrubber::scrub(dirtyEvent());

    expect($clean->getRequest())->toBe([])
        ->and($clean->getUser())->toBeNull()
        ->and($clean->getExtra())->toBe([])
        ->and($clean->getContexts())->toBe([])
        ->and($clean->getBreadcrumbs())->toBe([])
        ->and($clean->getExceptions()[0]->getValue())->toBe(ErrorScrubber::WITHHELD);

    $dump = json_encode([$clean->getRequest(), $clean->getTags(), $clean->getExtra(), $clean->getContexts(), $clean->getExceptions()[0]->getValue(), $clean->getTransaction()]);
    foreach (['SECRET', 'customer@example.test', '123456', 'X-Amz', 'SQLSTATE', 'select'] as $needle) {
        expect($dump)->not->toContain($needle);
    }
});

test('a concrete URL is never used as the transaction name', function () {
    $event = dirtyEvent();
    $event->setTransaction('/owner/organizations/7?token=SECRET-URL-TOKEN');

    expect(ErrorScrubber::scrub($event)->getTransaction())->toBeNull();
});

test('non-error events such as transactions are dropped', function () {
    $event = Event::createTransaction();

    expect($event->getType())->toBe(EventType::transaction())
        ->and(ErrorScrubber::scrub($event))->toBeNull();
});

test('a scrubbing failure drops the event instead of breaking the request', function () {
    $event = Event::createEvent();
    $event->setExceptions([]);
    $broken = new class extends ArrayObject {};
    Context::add('request_id', $broken); // not a string: ignored, never thrown

    expect(fn () => ErrorScrubber::scrub($event))->not->toThrow(Throwable::class);
});

test('error tracking is off without a DSN and the SDK sends nothing by default', function () {
    expect(config('sentry.dsn'))->toBeNull()
        ->and(config('sentry.send_default_pii'))->toBeFalse()
        ->and(config('sentry.traces_sample_rate'))->toBeNull()
        ->and(config('sentry.before_send'))->toBe([ErrorScrubber::class, 'scrub'])
        ->and(array_filter(config('sentry.breadcrumbs')))->toBe([]);
});
