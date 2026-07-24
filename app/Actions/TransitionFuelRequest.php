<?php

namespace App\Actions;

use App\Enums\FuelRequestStatus;
use App\Enums\PermissionName;
use App\Models\Attachment;
use App\Models\FuelLog;
use App\Models\FuelRequest;
use App\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

final class TransitionFuelRequest
{
    public function __construct(private RecordAuditEvent $audit) {}

    /**
     * @param  array<string, mixed>  $logDetails
     */
    public function handle(User $actor, FuelRequest $fuel, FuelRequestStatus $next, ?string $reason = null, array $logDetails = []): FuelRequest
    {
        [$requiredPreviousStatus, $permission] = match ($next) {
            FuelRequestStatus::Forwarded => [FuelRequestStatus::Submitted, PermissionName::FuelForward],
            FuelRequestStatus::Approved, FuelRequestStatus::Rejected => [FuelRequestStatus::Forwarded, PermissionName::FuelApprove],
            FuelRequestStatus::Verified => [FuelRequestStatus::Approved, PermissionName::FuelVerify],
            FuelRequestStatus::Logged => [FuelRequestStatus::Verified, PermissionName::FuelRecord],
            FuelRequestStatus::Submitted => throw ValidationException::withMessages(['status' => 'Unsupported fuel transition.']),
        };

        if (! $actor->can($permission->value) || (($next === FuelRequestStatus::Approved || $next === FuelRequestStatus::Rejected) && $fuel->requester_id === $actor->id)) {
            throw new AuthorizationException;
        }

        return DB::transaction(function () use ($actor, $fuel, $next, $reason, $requiredPreviousStatus, $logDetails): FuelRequest {
            /** @var FuelRequest $fuel */
            $fuel = FuelRequest::query()->lockForUpdate()->findOrFail($fuel->id);

            if ($fuel->status !== $requiredPreviousStatus) {
                throw ValidationException::withMessages(['status' => 'The fuel request is not at the required stage.']);
            }

            if ($next === FuelRequestStatus::Logged && $fuel->logs()->exists()) {
                throw ValidationException::withMessages(['status' => 'The fuel request has already been logged.']);
            }

            $before = ['status' => $fuel->status->value];

            $updateData = ['status' => $next, 'decision_reason' => $reason];
            if ($next === FuelRequestStatus::Forwarded) {
                $updateData['reviewed_by'] = $actor->id;
                $updateData['reviewed_at'] = now();
            } elseif ($next === FuelRequestStatus::Approved || $next === FuelRequestStatus::Rejected) {
                $updateData['approved_by'] = $actor->id;
                $updateData['approved_at'] = now();
            } elseif ($next === FuelRequestStatus::Verified) {
                $updateData['verified_by'] = $actor->id;
                $updateData['verified_at'] = now();
            }

            $fuel->update($updateData);

            if ($next === FuelRequestStatus::Logged) {
                $quantityLitres = isset($logDetails['quantity_litres']) ? (float) $logDetails['quantity_litres'] : (float) $fuel->quantity_litres;
                if ($quantityLitres <= 0) {
                    throw ValidationException::withMessages(['quantity_litres' => 'Fuel quantity must be greater than zero.']);
                }

                $pricePerLitre = isset($logDetails['price_per_litre']) && $logDetails['price_per_litre'] !== '' ? (float) $logDetails['price_per_litre'] : null;
                $totalCost = isset($logDetails['total_cost']) && $logDetails['total_cost'] !== '' ? (float) $logDetails['total_cost'] : ($pricePerLitre !== null ? round($pricePerLitre * $quantityLitres, 2) : null);

                $receiptPath = null;
                if (isset($logDetails['receipt']) && $logDetails['receipt'] instanceof UploadedFile) {
                    $file = $logDetails['receipt'];
                    $receiptPath = $file->store('receipts', 'private');
                } elseif (isset($logDetails['receipt_path']) && is_string($logDetails['receipt_path'])) {
                    $receiptPath = $logDetails['receipt_path'];
                }

                $fuelLog = FuelLog::query()->create([
                    'fuel_request_id' => $fuel->id,
                    'recorded_by' => $actor->id,
                    'quantity_litres' => $quantityLitres,
                    'odometer_km' => isset($logDetails['odometer_km']) && $logDetails['odometer_km'] !== '' ? (int) $logDetails['odometer_km'] : null,
                    'hour_meter' => isset($logDetails['hour_meter']) && $logDetails['hour_meter'] !== '' ? (float) $logDetails['hour_meter'] : null,
                    'price_per_litre' => $pricePerLitre,
                    'total_cost' => $totalCost,
                    'fuel_station' => isset($logDetails['fuel_station']) && is_string($logDetails['fuel_station']) ? $logDetails['fuel_station'] : null,
                    'remarks' => isset($logDetails['remarks']) && is_string($logDetails['remarks']) ? $logDetails['remarks'] : null,
                    'receipt_path' => $receiptPath,
                    'recorded_at' => now(),
                ]);

                if (isset($logDetails['receipt']) && $logDetails['receipt'] instanceof UploadedFile) {
                    /** @var UploadedFile $file */
                    $file = $logDetails['receipt'];
                    Attachment::query()->create([
                        'owner_type' => FuelLog::class,
                        'owner_id' => $fuelLog->id,
                        'uploaded_by' => $actor->id,
                        'kind' => 'fuel_receipt',
                        'disk' => 'private',
                        'path' => $receiptPath,
                        'original_filename' => $file->getClientOriginalName(),
                        'mime_type' => $file->getClientMimeType(),
                        'size_bytes' => $file->getSize(),
                        'checksum_sha256' => hash_file('sha256', $file->getRealPath()),
                    ]);
                }
            }

            $this->audit->handle($actor, $fuel, 'fuel.status_updated', $before, ['status' => $next->value], $reason);

            return $fuel->refresh();
        });
    }
}
