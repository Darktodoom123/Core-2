<?php

namespace App\Platform\Safety;

use App\Platform\Safety\Contracts\SosEscalationDelivery;
use App\Platform\Safety\Contracts\SosResponderDelivery;
use App\Platform\Safety\Models\SosEmergencyContact;
use App\Platform\Safety\Models\SosIncident;
use App\Platform\Safety\Policies\SosIncidentPolicy;
use App\Platform\Safety\Services\DatabaseSosResponderDelivery;
use App\Platform\Safety\Services\NullSosEscalationDelivery;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class SafetyServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SosResponderDelivery::class, DatabaseSosResponderDelivery::class);
        $this->app->bind(SosEscalationDelivery::class, NullSosEscalationDelivery::class);
    }

    public function boot(): void
    {
        Gate::policy(SosIncident::class, SosIncidentPolicy::class);
        Gate::define('configure', fn ($user, string $model): bool => $model === SosEmergencyContact::class
            && $user->operationalRole()?->value === 'system_administrator'
            && $user->can('sos.configure'));
    }
}
