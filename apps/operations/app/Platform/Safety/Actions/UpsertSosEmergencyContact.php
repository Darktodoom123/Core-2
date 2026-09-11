<?php

namespace App\Platform\Safety\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\SosEmergencyContact;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class UpsertSosEmergencyContact
{
    public function __construct(private readonly RecordAuditEvent $audit) {}

    /** @param array{name: string, role_label: string, phone_e164: string, escalation_order: int, is_active: bool} $data */
    public function handle(array $data, SosEmergencyContact $contact, User $actor): SosEmergencyContact
    {
        $phone = $data['phone_e164'];
        $hash = hash_hmac('sha256', $phone, (string) config('app.key'));

        return DB::transaction(function () use ($data, $phone, $hash, $contact, $actor): SosEmergencyContact {
            $before = $contact->exists ? [
                'name' => $contact->name,
                'role_label' => $contact->role_label,
                'escalation_order' => $contact->escalation_order,
                'is_active' => $contact->is_active,
            ] : null;
            $duplicate = SosEmergencyContact::query()
                ->where('phone_hash', $hash)
                ->when($contact->exists, fn ($query) => $query->where('id', '<>', $contact->id))
                ->exists();
            if ($duplicate) {
                throw ValidationException::withMessages(['phone_e164' => 'That company emergency contact is already configured.']);
            }

            $contact->fill([
                'name' => $data['name'],
                'role_label' => $data['role_label'],
                'phone_e164' => $phone,
                'phone_hash' => $hash,
                'escalation_order' => $data['escalation_order'],
                'is_active' => $data['is_active'],
            ])->save();

            $this->audit->handle($actor, $contact, $before === null ? 'safety.sos_contact_created' : 'safety.sos_contact_updated', $before, [
                'name' => $contact->name,
                'role_label' => $contact->role_label,
                'escalation_order' => $contact->escalation_order,
                'is_active' => $contact->is_active,
            ]);

            return $contact->fresh();
        });
    }
}
