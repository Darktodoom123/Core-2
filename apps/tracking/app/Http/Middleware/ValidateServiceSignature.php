<?php

namespace Tracking\Http\Middleware;

use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class ValidateServiceSignature
{
    /**
     * Maximum allowed clock drift tolerance in seconds (5 minutes).
     */
    public const int TOLERANCE_WINDOW_SECONDS = 300;

    /**
     * Handle an incoming request and validate HMAC-SHA256 service signature.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $serviceName = $request->header('X-Service-Name');
        /** @var list<string> $allowedServices */
        $allowedServices = config('services.tracking.allowed_services', ['operations']);

        if (empty($serviceName)) {
            return new JsonResponse([
                'message' => 'Missing X-Service-Name header.',
                'error' => 'unauthorized',
            ], 401);
        }

        if (! in_array($serviceName, $allowedServices, true)) {
            return new JsonResponse([
                'message' => 'Unauthorized service caller.',
                'error' => 'forbidden',
            ], 403);
        }

        $timestampHeader = $request->header('X-Timestamp');
        if ($timestampHeader === null || ! is_numeric($timestampHeader)) {
            return new JsonResponse([
                'message' => 'Missing or invalid X-Timestamp header.',
                'error' => 'unauthorized',
            ], 401);
        }

        $timestamp = (int) $timestampHeader;
        $now = time();
        if (abs($now - $timestamp) > self::TOLERANCE_WINDOW_SECONDS) {
            return new JsonResponse([
                'message' => 'Request timestamp expired or outside 5-minute tolerance window.',
                'error' => 'unauthorized',
            ], 401);
        }

        $payloadDigest = $request->header('X-Payload-Digest');
        if ($payloadDigest === null || $payloadDigest === '') {
            return new JsonResponse([
                'message' => 'Missing X-Payload-Digest header.',
                'error' => 'unauthorized',
            ], 401);
        }

        $rawBody = (string) $request->getContent();
        $expectedDigest = hash('sha256', $rawBody);

        $isGetOrHead = in_array(strtoupper($request->getMethod()), ['GET', 'HEAD'], true);
        $emptyDigest = hash('sha256', '');

        $digestMatches = hash_equals($expectedDigest, $payloadDigest)
            || ($isGetOrHead && hash_equals($emptyDigest, $payloadDigest));

        if (! $digestMatches) {
            return new JsonResponse([
                'message' => 'Payload digest mismatch.',
                'error' => 'unauthorized',
            ], 401);
        }

        $signature = $request->header('X-Signature');
        if ($signature === null || $signature === '') {
            return new JsonResponse([
                'message' => 'Missing X-Signature header.',
                'error' => 'unauthorized',
            ], 401);
        }

        $secret = (string) config('services.tracking.secret', '');
        if ($secret === '') {
            return new JsonResponse([
                'message' => 'Tracking service secret is not configured.',
                'error' => 'server_error',
            ], 500);
        }

        $method = strtoupper($request->getMethod());
        $rawPath = (string) parse_url($request->getRequestUri(), PHP_URL_PATH);
        $canonicalPath = '/'.trim($rawPath, '/');
        $pathWithoutSlash = trim($rawPath, '/');
        $rawUri = (string) $request->getRequestUri();

        $expectedSigWithSlash = hash_hmac('sha256', $method."\n".$canonicalPath."\n".$timestamp."\n".$payloadDigest, $secret);
        $expectedSigWithoutSlash = hash_hmac('sha256', $method."\n".$pathWithoutSlash."\n".$timestamp."\n".$payloadDigest, $secret);
        $expectedSigRawUri = hash_hmac('sha256', $method."\n".$rawUri."\n".$timestamp."\n".$payloadDigest, $secret);

        $strippedApiPath = '/'.ltrim((string) (preg_replace('#^/api/#', '/', $canonicalPath) ?? $canonicalPath), '/');
        $expectedSigStrippedApi = hash_hmac('sha256', $method."\n".$strippedApiPath."\n".$timestamp."\n".$payloadDigest, $secret);

        if (
            ! hash_equals($expectedSigWithSlash, $signature)
            && ! hash_equals($expectedSigWithoutSlash, $signature)
            && ! hash_equals($expectedSigRawUri, $signature)
            && ! hash_equals($expectedSigStrippedApi, $signature)
        ) {
            return new JsonResponse([
                'message' => 'Invalid HMAC-SHA256 request signature.',
                'error' => 'unauthorized',
            ], 401);
        }

        return $next($request);
    }
}
