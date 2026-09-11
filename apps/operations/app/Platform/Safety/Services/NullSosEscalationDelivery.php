<?php

namespace App\Platform\Safety\Services;

use App\Platform\Safety\Contracts\SosEscalationDelivery;
use App\Platform\Safety\Enums\SosDeliveryAttemptStatus;
use App\Platform\Safety\Models\SosDeliveryAttempt;
use App\Platform\Safety\Models\SosEmergencyContact;
use App\Platform\Safety\Models\SosIncident;

final class NullSosEscalationDelivery implements SosEscalationDelivery
{
    public function deliver(SosIncident $incident): void
    {
        SosEmergencyContact::query()->active()->each(function (SosEmergencyContact $contact) use ($incident): void {
            SosDeliveryAttempt::query()->firstOrCreate(
                [
                    'sos_incident_id' => $incident->id,
                    'channel' => 'sms',
                    'target_type' => 'company_contact',
                    'target_id' => (string) $contact->id,
                ],
                [
                    'attempt_status' => SosDeliveryAttemptStatus::Skipped,
                    'failure_code' => 'provider_not_configured',
                    'attempted_at' => now(),
                    'retry_count' => 0,
                ],
            );
        });
    }
}
