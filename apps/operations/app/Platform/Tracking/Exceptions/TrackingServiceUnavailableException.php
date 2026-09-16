<?php

namespace App\Platform\Tracking\Exceptions;

use RuntimeException;
use Throwable;

final class TrackingServiceUnavailableException extends RuntimeException
{
    public function __construct(string $message = 'Tracking service is unavailable.', int $code = 503, ?Throwable $previous = null)
    {
        parent::__construct($message, $code, $previous);
    }
}
