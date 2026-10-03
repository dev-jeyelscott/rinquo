<?php

use Illuminate\Support\Facades\Schedule;

// Horizon metrics (throughput / runtime graphs) are built from snapshots.
Schedule::command('horizon:snapshot')->everyFiveMinutes();
