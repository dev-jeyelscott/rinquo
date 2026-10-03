<?php

use App\Support\Diagnostics\FoundationSmokeJob;
use App\Support\Diagnostics\FoundationSmokeMail;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use League\Flysystem\UnableToWriteFile;

test('all checks pass when every dependency works', function () {
    Storage::fake();
    Mail::fake();

    $this->artisan('foundation:smoke', ['--mail-to' => 'smoke@example.com'])
        ->expectsOutputToContain('All foundation checks passed.')
        ->assertExitCode(0);

    Mail::assertSent(FoundationSmokeMail::class, fn (FoundationSmokeMail $mail) => $mail->hasTo('smoke@example.com'));
    expect(Storage::allFiles('diagnostics'))->toBeEmpty();
});

test('mail is skipped unless an address is given', function () {
    Storage::fake();
    Mail::fake();

    $this->artisan('foundation:smoke')->assertExitCode(0);

    Mail::assertNothingSent();
});

test('a failing object storage disk fails the command and shows only the exception class', function () {
    $disk = Mockery::mock(Filesystem::class);
    $disk->shouldReceive('put')->andThrow(UnableToWriteFile::atLocation('diagnostics/x.txt', 'endpoint secret-host.internal refused'));
    Storage::shouldReceive('disk')->andReturn($disk);

    $this->artisan('foundation:smoke')
        ->expectsOutputToContain(UnableToWriteFile::class)
        ->doesntExpectOutputToContain('secret-host.internal')
        ->expectsOutputToContain('One or more foundation checks failed.')
        ->assertExitCode(1);
});

test('the queue check fails when no worker processes the job', function () {
    Storage::fake();
    Queue::fake();

    $this->artisan('foundation:smoke', ['--queue-timeout' => 1])
        ->expectsOutputToContain(RuntimeException::class)
        ->assertExitCode(1);

    Queue::assertPushed(FoundationSmokeJob::class);
});

test('an invalid mail address is rejected before any check runs', function () {
    Mail::fake();

    $this->artisan('foundation:smoke', ['--mail-to' => 'not-an-email'])
        ->expectsOutputToContain('valid email address')
        ->assertExitCode(1);

    Mail::assertNothingSent();
});

test('an out-of-range queue timeout is rejected', function () {
    $this->artisan('foundation:smoke', ['--queue-timeout' => 0])->assertExitCode(1);
});
