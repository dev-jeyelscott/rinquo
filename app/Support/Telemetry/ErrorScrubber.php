<?php

namespace App\Support\Telemetry;

use Illuminate\Routing\Route;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Request;
use Sentry\Event;
use Sentry\EventHint;
use Sentry\EventType;
use Throwable;

/**
 * Builds the only error report Rinquo sends to Sentry. Instead of removing known-bad fields
 * from the SDK's event, it constructs a new event from an allowlist: release, environment,
 * level, exception class and stack frames, the route template, a job class and an opaque
 * correlation id. Request data, cookies, headers, users, breadcrumbs, extra data, contexts and
 * every exception message (which can embed SQL, URLs or provider payloads) are never copied.
 * A scrubbing failure drops the event: telemetry must never break request handling.
 */
final class ErrorScrubber
{
    public const WITHHELD = '[message withheld]';

    /** Tags taken from the SDK's event; route and correlation id are set from application state below. */
    private const CARRIED_TAGS = ['job_class'];

    public static function scrub(Event $event, ?EventHint $hint = null): ?Event
    {
        try {
            if ($event->getType() !== EventType::event()) {
                return null;
            }

            $clean = Event::createEvent($event->getId());
            $clean->setTimestamp($event->getTimestamp());
            $clean->setLevel($event->getLevel());
            $clean->setLogger($event->getLogger());
            $clean->setRelease($event->getRelease());
            $clean->setEnvironment($event->getEnvironment());
            $clean->setSdkIdentifier($event->getSdkIdentifier());
            $clean->setSdkVersion($event->getSdkVersion());

            // The transaction is the route template (for example /owner/organizations/{organization}), never a concrete URL.
            $transaction = $event->getTransaction();
            $clean->setTransaction(is_string($transaction) && ! str_contains($transaction, '?') ? $transaction : null);

            foreach ($event->getExceptions() as $bag) {
                $bag->setValue(self::WITHHELD);
            }
            $clean->setExceptions($event->getExceptions());
            if ($event->getExceptions() === [] && $event->getMessage() !== null) {
                $clean->setMessage(self::WITHHELD);
            }

            $tags = array_intersect_key($event->getTags(), array_flip(self::CARRIED_TAGS));
            /** @var Route|null $current */
            $current = Request::route();
            $route = $current instanceof Route ? $current->getName() : null;
            $requestId = Context::get('request_id');
            if (is_string($route)) {
                $tags['route'] = $route;
            }
            if (is_string($requestId)) {
                $tags['correlation_id'] = $requestId;
            }
            $clean->setTags($tags);

            return $clean;
        } catch (Throwable) {
            return null;
        }
    }
}
