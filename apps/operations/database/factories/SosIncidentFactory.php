<?php

namespace Database\Factories;

use App\Platform\Identity\Models\User;
use App\Platform\Safety\Enums\SosIncidentCategory;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<SosIncident> */
final class SosIncidentFactory extends Factory
{
    protected $model = SosIncident::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $receivedAt = now();

        return [
            'id' => (string) Str::uuid(),
            'command_id' => (string) Str::uuid(),
            'reporter_id' => User::factory(),
            'category' => SosIncidentCategory::Unclassified,
            'status' => SosIncidentStatus::Active,
            'device_activated_at' => $receivedAt,
            'received_at' => $receivedAt,
            'escalation_due_at' => $receivedAt->addSeconds(180),
            'version' => 1,
        ];
    }
}
