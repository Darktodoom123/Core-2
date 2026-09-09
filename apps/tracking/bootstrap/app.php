<?php

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Tracking\Console\Commands\PruneLocationUpdatesCommand;

require_once __DIR__.'/autoload.php';

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        api: __DIR__.'/../routes/api.php',
        apiPrefix: '',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule): void {
        $schedule->command(PruneLocationUpdatesCommand::class)
            ->dailyAt('02:15')
            ->withoutOverlapping()
            ->name('tracking:prune-retention');
    })
    ->withMiddleware(function (Middleware $middleware): void {
        // Dedicated lightweight microservice middleware
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => true);
    })
    ->create();
