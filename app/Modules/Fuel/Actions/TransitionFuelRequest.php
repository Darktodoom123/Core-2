<?php

namespace App\Modules\Fuel\Actions;

use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Platform\Attachments\Actions\UploadAttachmentAction;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

final class TransitionFuelRequest
{
    public function __construct(
        private RecordAuditEvent $audit,
        private UploadAttachmentAction $uploadAttachment,
        private CalculateFuelVarianceAndBurnRate $calculateVariance,
    ) {}

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

        if (array_key_exists('receipt_path', $logDetails)) {
            throw ValidationException::withMessages(['receipt' => 'Receipt paths must be generated from an uploaded file.']);
        }

        $receiptAttachment = null;

        try {
            return DB::transaction(function () use ($actor, $fuel, $next, $reason, $requiredPreviousStatus, $logDetails, &$receiptAttachment): FuelRequest {
                /** @var FuelRequest $fuel */
                $fuel = FuelRequest::query()->with('asset')->lockForUpdate()->findOrFail($fuel->id);

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

                    $odometerKm = isset($logDetails['odometer_km']) && $logDetails['odometer_km'] !== '' ? (int) $logDetails['odometer_km'] : null;
                    $hourMeter = isset($logDetails['hour_meter']) && $logDetails['hour_meter'] !== '' ? (float) $logDetails['hour_meter'] : null;
                    $pricePerLitre = isset($logDetails['price_per_litre']) && $logDetails['price_per_litre'] !== '' ? (float) $logDetails['price_per_litre'] : null;
                    $totalCost = isset($logDetails['total_cost']) && $logDetails['total_cost'] !== '' ? (float) $logDetails['total_cost'] : ($pricePerLitre !== null ? round($pricePerLitre * $quantityLitres, 2) : null);

                    $asset = $fuel->asset;
                    if ($asset !== null) {
                        $isOdometer = in_array($asset->meter_type, ['odometer', 'odometer_km'], true);
                        $isHourMeter = in_array($asset->meter_type, ['hour_meter', 'engine_hours'], true);

                        if ($isOdometer && $odometerKm !== null && $asset->meter_value !== null && $odometerKm < (float) $asset->meter_value) {
                            throw ValidationException::withMessages([
                                'odometer_km' => "Odometer reading ({$odometerKm} km) cannot be less than current asset meter ({$asset->meter_value} km).",
                            ]);
                        }

                        if ($isHourMeter && $hourMeter !== null && $asset->meter_value !== null && $hourMeter < (float) $asset->meter_value) {
                            throw ValidationException::withMessages([
                                'hour_meter' => "Hour meter reading ({$hourMeter} hrs) cannot be less than current asset meter ({$asset->meter_value} hrs).",
                            ]);
                        }
                    }

                    $varianceResult = $this->calculateVariance->execute($fuel, $quantityLitres, $odometerKm, $hourMeter);

                    $fuelLog = FuelLog::query()->create([
                        'fuel_request_id' => $fuel->id,
                        'recorded_by' => $actor->id,
                        'quantity_litres' => $quantityLitres,
                        'odometer_km' => $odometerKm,
                        'hour_meter' => $hourMeter,
                        'price_per_litre' => $pricePerLitre,
                        'total_cost' => $totalCost,
                        'fuel_station' => isset($logDetails['fuel_station']) && is_string($logDetails['fuel_station']) ? $logDetails['fuel_station'] : null,
                        'remarks' => isset($logDetails['remarks']) && is_string($logDetails['remarks']) ? $logDetails['remarks'] : null,
                        'variance_litres' => $varianceResult->varianceLitres,
                        'variance_percentage' => $varianceResult->variancePercentage,
                        'effective_burn_rate' => $varianceResult->effectiveBurnRate,
                        'burn_rate_unit' => $varianceResult->burnRateUnit,
                        'is_anomaly' => $varianceResult->isAnomaly,
                        'anomaly_reason' => $varianceResult->anomalyReason,
                        'receipt_path' => null,
                        'recorded_at' => now(),
                    ]);

                    if ($asset !== null) {
                        $isOdometer = in_array($asset->meter_type, ['odometer', 'odometer_km'], true);
                        $isHourMeter = in_array($asset->meter_type, ['hour_meter', 'engine_hours'], true);

                        if ($isOdometer && $odometerKm !== null && ($asset->meter_value === null || $odometerKm > (float) $asset->meter_value)) {
                            $asset->update(['meter_value' => $odometerKm]);
                        } elseif ($isHourMeter && $hourMeter !== null && ($asset->meter_value === null || $hourMeter > (float) $asset->meter_value)) {
                            $asset->update(['meter_value' => $hourMeter]);
                        }
                    }

                    if (isset($logDetails['receipt']) && $logDetails['receipt'] instanceof UploadedFile) {
                        $receiptAttachment = $this->uploadAttachment->execute($actor, $fuelLog, $logDetails['receipt'], 'fuel_receipt');
                        $fuelLog->update(['receipt_path' => $receiptAttachment->path]);
                    }
                }

                $this->audit->handle($actor, $fuel, 'fuel.status_updated', $before, ['status' => $next->value], $reason);

                return $fuel->refresh();
            });
        } catch (\Throwable $exception) {
            if ($receiptAttachment instanceof Attachment) {
                Storage::disk($receiptAttachment->disk)->delete($receiptAttachment->path);
            }

            throw $exception;
        }
    }
}
