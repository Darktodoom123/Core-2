<?php

namespace App\Modules\Fuel\Actions;

use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class SubmitMobileFuelRequest
{
    public function __construct(private RecordAuditEvent $audit) {}

    /** @param array<string, mixed> $data */
    public function handle(User $actor, array $data): FuelRequest
    {
        $data['quantity_litres'] = number_format((float) $data['quantity_litres'], 2, '.', '');
        foreach (['operational_asset_id', 'dispatch_job_id', 'operator_shift_id'] as $key) {
            $data[$key] = isset($data[$key]) ? (int) $data[$key] : null;
        }
        ksort($data);
        $hash = hash('sha256', json_encode($data, JSON_THROW_ON_ERROR));

        return DB::transaction(function () use ($actor, $data, $hash): FuelRequest {
            User::query()->whereKey($actor->id)->lockForUpdate()->firstOrFail();
            $existing = FuelRequest::query()->where('requester_id', $actor->id)->where('client_request_id', $data['client_request_id'])->first();
            if ($existing) {
                abort_unless(hash_equals((string) $existing->getAttribute('client_payload_hash'), $hash), 409, 'This submission identifier was already used for different details.');

                return $existing;
            }
            $fuel = new FuelRequest;
            $fuel->fill([...$data, 'reference' => 'FUEL-'.now()->format('YmdHis').'-'.Str::lower(Str::random(8)), 'requester_id' => $actor->id, 'status' => FuelRequestStatus::Submitted]);
            $fuel->setAttribute('client_request_id', $data['client_request_id']);
            $fuel->setAttribute('client_payload_hash', $hash);
            $fuel->save();
            $this->audit->handle($actor, $fuel, 'fuel.requested', null, $fuel->only(['reference', 'requester_id', 'quantity_litres', 'fuel_type', 'status']));

            return $fuel;
        });
    }
}
