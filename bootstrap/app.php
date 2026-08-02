<?php

use App\Platform\Identity\Http\Middleware\EnsurePersonalAccessToken;
use App\Platform\Identity\Http\Middleware\EnsureUserIsActive;
use App\Platform\Workspace\Http\Middleware\HandleInertiaRequests;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

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
    })
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'active' => EnsureUserIsActive::class,
            'api-token' => EnsurePersonalAccessToken::class,
        ]);

        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        $exceptions->render(function (ValidationException $e, Request $request) {
            $version = $request->input('version');
            $hasValidVersion = is_int($version)
                || (is_string($version) && filter_var($version, FILTER_VALIDATE_INT) !== false);

            if (
                ($request->is('api/*') || $request->expectsJson())
                && isset($e->errors()['version'])
                && $hasValidVersion
                && (int) $version >= 1
            ) {
                return response()->json([
                    'message' => $e->errors()['version'][0] ?? 'Version conflict detected.',
                    'error' => 'stale_version',
                    'errors' => $e->errors(),
                ], 409);
            }
        });
    })->create();
