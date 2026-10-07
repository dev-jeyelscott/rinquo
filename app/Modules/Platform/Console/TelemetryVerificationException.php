<?php

namespace App\Modules\Platform\Console;

use RuntimeException;

/** Distinct class name so the verification event is unmistakable in the Sentry project. */
final class TelemetryVerificationException extends RuntimeException {}
