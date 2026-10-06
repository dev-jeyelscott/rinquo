<?php

namespace App\Modules\Subscription\PayMongo;

use RuntimeException;

/** A provider call failed or returned something unusable. The message is safe to log, never to show verbatim. */
final class PayMongoException extends RuntimeException {}
