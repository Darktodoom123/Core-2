<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Safety\Models\SosEmergencyContact;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class UpsertSosEmergencyContact
{
    /** @param array{name: string, role_label: string, phone_e164: string, escalation_order: int, is_active: bool} $data */
    public function handle(array $data, ?SosEmergencyContact $contact = null): SosEmergencyContact
    {
        $phone = $data['phone_e164'];
        $hash = hash_hmac('sha256', $phone, (string) config('app.key'));

        return DB::transaction(function () use ($data, $phone, $hash, $contact): SosEmergencyContact {
            $duplicate = SosEmergencyContact::query()->where('phone_hash', $hash)->when($contact !== null, fn ($query) => $query->where('id', '<>', $contact->id))->exists();
            if ($duplicate) {
                throw ValidationException::withMessages(['phone_e164' => 'That company emergency contact is already configured.']);
            }

            $contact ??= new SosEmergencyContact;
            $contact->fill([
                'name' => $data['name'],
                'role_label' => $data['role_label'],
                'phone_e164' => $phone,
                'phone_hash' => $hash,
                'escalation_order' => $data['escalation_order'],
                'is_active' => $data['is_active'],
            ])->save();

            return $contact->fresh();
        });
    }
}
