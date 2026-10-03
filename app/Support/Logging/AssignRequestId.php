<?php

namespace App\Support\Logging;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gives every request a correlation id that appears in all log entries
 * (and queued jobs dispatched by the request) and in the response header.
 *
 * An incoming id is reused only when it is short and safe to log; anything
 * else is replaced, so clients cannot inject arbitrary content into logs.
 */
final class AssignRequestId
{
    public const HEADER = 'X-Request-Id';

    private const ACCEPTED_PATTERN = '/^[A-Za-z0-9._-]{1,64}$/';

    public function handle(Request $request, Closure $next): Response
    {
        $incoming = $request->headers->get(self::HEADER);

        $requestId = is_string($incoming) && preg_match(self::ACCEPTED_PATTERN, $incoming) === 1
            ? $incoming
            : (string) Str::uuid();

        $request->headers->set(self::HEADER, $requestId);
        Context::add('request_id', $requestId);

        /** @var Response $response */
        $response = $next($request);
        $response->headers->set(self::HEADER, $requestId);

        return $response;
    }
}
