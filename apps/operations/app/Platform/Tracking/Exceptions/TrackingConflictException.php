<?php

namespace App\Platform\Tracking\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;

final class TrackingConflictException extends HttpException
{
    /**
     * @param  array<string, mixed>|null  $responseBody
     */
    public function __construct(
        string $message = 'This command ID was already used for a different command payload.',
        public ?array $responseBody = null,
        ?\Throwable $previous = null,
    ) {
        parent::__construct(409, $message, $previous);
    }
}
