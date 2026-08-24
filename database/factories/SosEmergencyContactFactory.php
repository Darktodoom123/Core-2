<?php

namespace Database\Factories;

use App\Platform\Safety\Models\SosEmergencyContact;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<SosEmergencyContact> */
final class SosEmergencyContactFactory extends Factory
{
    protected $model = SosEmergencyContact::class;

    /** @return array<string, mixed> */
    public function definition(): array
    {
        $phone = sprintf('+1555%07d', fake()->unique()->numberBetween(0, 9999999));

        return [
            'name' => 'Synthetic Emergency Contact '.fake()->unique()->numberBetween(1, 9999),
            'role_label' => 'Synthetic test contact',
            'phone_e164' => $phone,
            'phone_hash' => hash_hmac('sha256', $phone, (string) config('app.key')),
            'escalation_order' => 1,
            'is_active' => true,
        ];
    }
}
