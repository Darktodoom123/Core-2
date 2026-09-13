<?php

use App\Platform\Attachments\Jobs\PruneExpiredAttachmentsJob;
use App\Platform\Gpt\Jobs\PruneGptRecommendationsJob;
use App\Platform\Gpt\Jobs\SweepProactiveGptRecommendationsJob;
use App\Platform\Identity\Http\Middleware\EnsurePersonalAccessToken;
use App\Platform\Identity\Http\Middleware\EnsureUserIsActive;
use App\Platform\Identity\Http\Middleware\ValidateActiveSession;
use App\Platform\Reporting\Jobs\PruneExpiredExportsJob;
use App\Platform\Safety\Jobs\PruneSosIncidentCoordinatesJob;
use App\Platform\Safety\Jobs\SweepSosEscalationsJob;
use App\Platform\Security\Http\Middleware\AssignRequestId;
use App\Platform\Security\Http\Middleware\EnforceSecurityHeaders;
use App\Platform\Workspace\Http\Middleware\CollectWorkspacePerformance;
use App\Platform\Workspace\Http\Middleware\HandleInertiaRequests;
use App\Shared\Http\Exceptions\VersionConflictException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command('location:prune')->dailyAt('02:15');
        $schedule->job(new PruneExpiredExportsJob, 'reports')->dailyAt('02:30')->withoutOverlapping()->name('reports:prune-expired');
        $schedule->job(new PruneGptRecommendationsJob, 'ai')->dailyAt('02:45')->withoutOverlapping()->name('gpt:prune-retention');
        $schedule->job(new SweepProactiveGptRecommendationsJob, 'ai')->everyMinute()->withoutOverlapping()->name('gpt:proactive-sweep');
        $schedule->job(new PruneExpiredAttachmentsJob)->dailyAt('03:00')->withoutOverlapping()->name('attachments:prune-expired');
        $schedule->job(new SweepSosEscalationsJob)->everyMinute()->withoutOverlapping()->name('sos:escalation-sweep');
        $schedule->job(new PruneSosIncidentCoordinatesJob)->dailyAt('03:15')->withoutOverlapping()->name('sos:prune-coordinates');
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'api-token' => EnsurePersonalAccessToken::class,
        ]);

        $middleware->prepend(AssignRequestId::class);
        $middleware->append(EnforceSecurityHeaders::class);

        $middleware->web(append: [
            HandleInertiaRequests::class,
            CollectWorkspacePerformance::class,
            AddLinkHeadersForPreloadedAssets::class,
            ValidateActiveSession::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $resolveRequestId = static function (Request $request): string {
            $id = $request->attributes->get('request_id') ?? $request->header('X-Request-Id');

            return is_string($id) && $id !== '' ? $id : (string) Str::uuid();
        };

        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (VersionConflictException $e, Request $request) {
            return $e->render($request);
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($resolveRequestId) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $requestId = $resolveRequestId($request);

                return response()->json([
                    'message' => 'Unauthenticated.',
                    'error' => 'unauthenticated',
                    'request_id' => $requestId,
                ], 401)->header('X-Request-Id', $requestId);
            }
        });

        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) use ($resolveRequestId) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $requestId = $resolveRequestId($request);

                return response()->json([
                    'message' => $e->getMessage() ?: 'This action is unauthorized.',
                    'error' => 'forbidden',
                    'request_id' => $requestId,
                ], 403)->header('X-Request-Id', $requestId);
            }
        });

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) use ($resolveRequestId) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $requestId = $resolveRequestId($request);
                $message = $e instanceof ModelNotFoundException
                    ? 'The requested resource could not be found.'
                    : ($e->getMessage() ?: 'Resource not found.');

                return response()->json([
                    'message' => $message,
                    'error' => 'not_found',
                    'request_id' => $requestId,
                ], 404)->header('X-Request-Id', $requestId);
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) use ($resolveRequestId) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $requestId = $resolveRequestId($request);
                $version = $request->input('version');
                $hasValidVersion = is_int($version)
                    || (is_string($version) && filter_var($version, FILTER_VALIDATE_INT) !== false);

                if (isset($e->errors()['version']) && $hasValidVersion && (int) $version >= 1) {
                    return response()->json([
                        'message' => $e->errors()['version'][0] ?? 'Version conflict detected.',
                        'error' => 'stale_version',
                        'errors' => $e->errors(),
                        'request_id' => $requestId,
                    ], 409)->header('X-Request-Id', $requestId);
                }

                return response()->json([
                    'message' => $e->getMessage(),
                    'error' => 'validation_failed',
                    'errors' => $e->errors(),
                    'request_id' => $requestId,
                ], 422)->header('X-Request-Id', $requestId);
            }
        });

        $exceptions->render(function (TooManyRequestsHttpException $e, Request $request) use ($resolveRequestId) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $requestId = $resolveRequestId($request);
                $headers = $e->getHeaders();
                $retryAfter = $headers['Retry-After'] ?? null;

                $payload = [
                    'message' => $e->getMessage() ?: 'Too many requests. Please slow down.',
                    'error' => 'rate_limited',
                    'request_id' => $requestId,
                ];

                if ($retryAfter !== null) {
                    $payload['retry_after'] = (int) $retryAfter;
                }

                return response()->json($payload, 429, $headers)->header('X-Request-Id', $requestId);
            }
        });

        $exceptions->render(function (Throwable $e, Request $request) use ($resolveRequestId) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $requestId = $resolveRequestId($request);

                if ($e instanceof HttpExceptionInterface) {
                    $status = $e->getStatusCode();

                    return response()->json([
                        'message' => $e->getMessage() ?: 'An HTTP error occurred.',
                        'error' => match ($status) {
                            400 => 'bad_request',
                            401 => 'unauthenticated',
                            403 => 'forbidden',
                            404 => 'not_found',
                            405 => 'method_not_allowed',
                            409 => 'conflict',
                            422 => 'validation_failed',
                            429 => 'rate_limited',
                            503 => 'service_unavailable',
                            default => 'http_error',
                        },
                        'request_id' => $requestId,
                    ], $status, $e->getHeaders())->header('X-Request-Id', $requestId);
                }

                Log::error($e->getMessage(), [
                    'request_id' => $requestId,
                    'url' => $request->fullUrl(),
                    'method' => $request->method(),
                    'user_id' => $request->user()?->id,
                    'exception' => get_class($e),
                    'trace' => $e->getTraceAsString(),
                ]);

                if (config('app.debug')) {
                    return response()->json([
                        'message' => $e->getMessage(),
                        'error' => 'internal_server_error',
                        'request_id' => $requestId,
                        'debug' => [
                            'exception' => get_class($e),
                            'file' => $e->getFile(),
                            'line' => $e->getLine(),
                        ],
                    ], 500)->header('X-Request-Id', $requestId);
                }

                return response()->json([
                    'message' => 'An unexpected server error occurred.',
                    'error' => 'internal_server_error',
                    'request_id' => $requestId,
                ], 500)->header('X-Request-Id', $requestId);
            }
        });

        $exceptions->respond(function (SymfonyResponse $response, Throwable $exception, Request $request) use ($resolveRequestId) {
            if ($response->getStatusCode() === 419) {
                return back()->with('flash', [
                    'tone' => 'warning',
                    'message' => 'Your session expired due to inactivity. Please try again.',
                ]);
            }

            if (
                ! app()->environment(['local', 'testing'])
                && ! $request->is('api/*')
                && ! $request->expectsJson()
                && in_array($response->getStatusCode(), [403, 404, 429, 500, 503], true)
            ) {
                return Inertia::render('error', [
                    'status' => $response->getStatusCode(),
                    'requestId' => $resolveRequestId($request),
                ])->toResponse($request)->setStatusCode($response->getStatusCode());
            }

            return $response;
        });
    })->create();
