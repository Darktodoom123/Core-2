<?php

namespace App\Platform\Tracking\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

final class TrackingServiceUnavailableException extends HttpException
{
    /**
     * @param  array<string, mixed>|null  $responseBody
     */
    public function __construct(
        string $message = 'Tracking microservice is temporarily unavailable. Please retry.',
        public ?array $responseBody = null,
        ?Throwable $previous = null,
    ) {
        parent::__construct(503, $message, $previous, ['Retry-After' => '5']);
    }
}
