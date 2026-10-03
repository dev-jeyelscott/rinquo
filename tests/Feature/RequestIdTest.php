<?php

use App\Support\Logging\AssignRequestId;
use Illuminate\Support\Facades\Context;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Monolog\Handler\TestHandler;

beforeEach(function () {
    config(['logging.channels.capture' => ['driver' => 'monolog', 'handler' => TestHandler::class]]);

    Route::get('/__test/request-id', function () {
        Log::channel('capture')->info('request id probe');

        return response()->json(['context' => Context::get('request_id')]);
    });
});

test('a valid incoming request id is reused and echoed', function () {
    $this->getJson('/__test/request-id', [AssignRequestId::HEADER => 'abc-123.DEF_456'])
        ->assertOk()
        ->assertHeader(AssignRequestId::HEADER, 'abc-123.DEF_456')
        ->assertJson(['context' => 'abc-123.DEF_456']);
});

test('an invalid incoming request id is replaced with a generated uuid', function (string $invalid) {
    $response = $this->getJson('/__test/request-id', [AssignRequestId::HEADER => $invalid]);

    $requestId = $response->headers->get(AssignRequestId::HEADER);

    expect($requestId)->not->toBe($invalid)
        ->and(Str::isUuid($requestId))->toBeTrue();
})->with([
    'contains spaces and markup' => 'bad id <script>',
    'too long' => str_repeat('a', 65),
    'newline injection' => "abc\nforged-log-line",
]);

test('a request id is generated when none is sent, including for readiness', function () {
    $requestId = $this->getJson('/ready')->headers->get(AssignRequestId::HEADER);

    expect(Str::isUuid($requestId))->toBeTrue();
});

test('the request id is attached to log entries', function () {
    $this->getJson('/__test/request-id', [AssignRequestId::HEADER => 'trace-me-1'])->assertOk();

    /** @var TestHandler $handler */
    $handler = Log::channel('capture')->getLogger()->getHandlers()[0];
    $record = $handler->getRecords()[0];

    expect($record->extra['request_id'] ?? null)->toBe('trace-me-1');
});
