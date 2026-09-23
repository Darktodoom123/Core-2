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
use Illuminate\Support\Facades\Vite;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;
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
        // Browser tests serve the built bundle. A stale public/hot marker from
        // a stopped local Vite process must not switch the test server back to
        // an unavailable HMR origin.
        if (app()->environment('testing')) {
            Vite::useHotFile(storage_path('framework/testing/browser-vite.hot'));
        }

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
        RateLimiter::for('api', static fn (Request $request): Limit => $request->user()
            ? Limit::perMinute(180)->by($request->user()->id)
            : Limit::perMinute(60)->by($request->ip() ?: 'unknown'));

        RateLimiter::for('login', static function (Request $request): array {
            $rawUsername = $request->input('username');
            $rawEmail = $request->input('email');
            $identifier = is_string($rawUsername) ? $rawUsername : (is_string($rawEmail) ? $rawEmail : '');
            $identifierKey = Str::transliterate(Str::lower(trim($identifier)).'|'.($request->ip() ?: 'unknown'));

            return [
                Limit::perMinute(10)->by($request->ip() ?: 'unknown'),
                Limit::perMinute(5)->by($identifierKey),
            ];
        });

        RateLimiter::for('password-reset', static fn (Request $request): Limit => Limit::perMinute(5)->by($request->ip() ?: 'unknown'));

        RateLimiter::for('location', static fn (Request $request): Limit => Limit::perMinute(60)->by($request->user()?->id ?: $request->ip() ?: 'unknown'));

        RateLimiter::for('uploads', static fn (Request $request): Limit => Limit::perMinute(20)->by($request->user()?->id ?: $request->ip() ?: 'unknown'));

        RateLimiter::for('downloads', static fn (Request $request): Limit => Limit::perMinute(60)->by($request->user()?->id ?: $request->ip() ?: 'unknown'));

        RateLimiter::for('exports', static fn (Request $request): Limit => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip() ?: 'unknown'));

        RateLimiter::for('gpt', static fn (Request $request): Limit => Limit::perMinute(10)->by($request->user()?->id ?: $request->ip() ?: 'unknown'));

        RateLimiter::for('safety', static fn (Request $request): Limit => Limit::perMinute(60)->by($request->user()?->id ?: $request->ip() ?: 'unknown'));

        RateLimiter::for('weather', static fn (Request $request): Limit => Limit::perMinute(60)->by($request->user()?->id ?: $request->ip() ?: 'unknown'));

        RateLimiter::for('sos', static fn (Request $request): Limit => Limit::perMinute(12)->by(sprintf(
            '%s:%s',
            $request->user()?->id ?: $request->ip() ?: 'unknown',
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
