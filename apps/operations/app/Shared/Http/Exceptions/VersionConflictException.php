<?php

namespace App\Shared\Http\Exceptions;

use Exception;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class VersionConflictException extends Exception
{
    /**
     * @param  array<string, mixed>|null  $snapshot
     */
    public function __construct(
        string $message = 'Version conflict detected.',
        private readonly int $currentVersion = 0,
        private readonly ?array $snapshot = null,
        int $code = 0,
        ?\Throwable $previous = null,
    ) {
        parent::__construct($message, $code, $previous);
    }

    public function getCurrentVersion(): int
    {
        return $this->currentVersion;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function getSnapshot(): ?array
    {
        return $this->snapshot;
    }

    public function render(Request $request): JsonResponse
    {
        $requestId = $request->attributes->get('request_id') ?? $request->header('X-Request-Id');

        $payload = [
            'message' => $this->getMessage(),
            'error' => 'stale_version',
            'current_version' => $this->currentVersion,
        ];

        if (is_string($requestId) && $requestId !== '') {
            $payload['request_id'] = $requestId;
        }

        if ($this->snapshot !== null) {
            $payload['data'] = $this->snapshot;
        }

        $response = new JsonResponse($payload, Response::HTTP_CONFLICT);
        if (is_string($requestId) && $requestId !== '') {
            $response->headers->set('X-Request-Id', $requestId);
        }

        return $response;
    }
}
