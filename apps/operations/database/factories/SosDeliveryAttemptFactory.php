<?php

namespace Database\Factories;

use App\Platform\Safety\Enums\SosDeliveryAttemptStatus;
use App\Platform\Safety\Models\SosDeliveryAttempt;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<SosDeliveryAttempt> */
final class SosDeliveryAttemptFactory extends Factory
{
    protected $model = SosDeliveryAttempt::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        return [
            'sos_incident_id' => SosIncident::factory(),
            'channel' => 'database',
            'target_type' => 'user',
            'target_id' => (string) fake()->numberBetween(1, 1000),
            'attempt_status' => SosDeliveryAttemptStatus::Pending,
            'attempted_at' => now(),
            'retry_count' => 0,
        ];
    }
}
