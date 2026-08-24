<?php

namespace App\Providers;

use App\Platform\Workspace\Support\WorkspacePerformanceCollector;
use Carbon\CarbonImmutable;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(WorkspacePerformanceCollector::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        $this->configureRateLimiting();
        DB::listen(function (QueryExecuted $query): void {
            app(WorkspacePerformanceCollector::class)->recordQuery((float) $query->time);
        });
    }

    /**
     * Configure named rate limiters for sensitive endpoints.
     */
    protected function configureRateLimiting(): void
    {
        RateLimiter::for('location', static fn (Request $request): Limit => Limit::perMinute(60)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('uploads', static fn (Request $request): Limit => Limit::perMinute(20)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('exports', static fn (Request $request): Limit => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('gpt', static fn (Request $request): Limit => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip()));

        RateLimiter::for('sos', static fn (Request $request): Limit => Limit::perMinute(12)->by(sprintf(
            '%s:%s',
            $request->user()?->id ?: $request->ip(),
            (string) ($request->user()?->currentAccessToken()->id ?? 'session'),
        )));
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
