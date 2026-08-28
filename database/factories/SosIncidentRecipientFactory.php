<?php

namespace Database\Factories;

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SosIncident;
use App\Platform\Safety\Models\SosIncidentRecipient;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<SosIncidentRecipient> */
final class SosIncidentRecipientFactory extends Factory
{
    protected $model = SosIncidentRecipient::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'sos_incident_id' => SosIncident::factory(),
            'user_id' => User::factory(),
            'role_at_alert' => RoleName::OperationsManager->value,
            'resolution_reason' => 'operations_manager_fallback',
        ];
    }
}
