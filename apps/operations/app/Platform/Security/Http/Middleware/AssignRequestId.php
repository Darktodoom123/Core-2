<?php

namespace App\Platform\Security\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\Response;

final class AssignRequestId
{
    /**
     * Assign a unique correlation ID to the incoming request and outgoing response.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $headerId = $request->header('X-Request-Id');
        $requestId = is_string($headerId) && trim($headerId) !== '' && strlen($headerId) <= 64
            ? trim($headerId)
            : (string) Str::uuid();

        $request->headers->set('X-Request-Id', $requestId);
        $request->attributes->set('request_id', $requestId);

        /** @var Response $response */
        $response = $next($request);

        $response->headers->set('X-Request-Id', $requestId);

        return $response;
    }
}
