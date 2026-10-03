<?php

// The Laravel arch preset is intentionally not applied: it requires mailables
// and jobs under App\Mail / App\Jobs, while cross-cutting diagnostics live in
// App\Support\Diagnostics and domain classes will live in their modules.

arch('shared support code does not depend on domain modules')
    ->expect('App\Support')
    ->not->toUse('App\Modules');

arch('no debugging statements are left in application code')
    ->expect(['dd', 'dump', 'ddd', 'ray', 'var_dump', 'print_r'])
    ->not->toBeUsed();

arch('application code does not read env() outside configuration')
    ->expect('env')
    ->not->toBeUsed()
    ->ignoring('config');
