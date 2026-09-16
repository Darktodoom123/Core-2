<?php

namespace App\Platform\Tracking\Exceptions;

use Symfony\Component\HttpKernel\Exception\HttpException;
use Throwable;

final class TrackingServiceUnavailableException extends HttpException
{
    /**
     * @var array<string, mixed>|null
     */
    public ?array $responseBody = null;

    /**
     * @param  array<string, mixed>|int|null  $responseBody
     */
    public function __construct(
        string $message = 'Tracking microservice is temporarily unavailable. Please retry.',
        array|int|null $responseBody = null,
        ?Throwable $previous = null,
    ) {
        $this->responseBody = is_array($responseBody) ? $responseBody : null;
        parent::__construct(503, $message, $previous, ['Retry-After' => '5']);
    }
}
