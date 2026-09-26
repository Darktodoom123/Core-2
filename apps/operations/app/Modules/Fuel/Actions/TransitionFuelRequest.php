<?php

namespace App\Modules\Fuel\Actions;

use App\Modules\Fuel\Enums\FuelNoReceiptReason;
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
        private FuelNotifier $notifier,
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
            FuelRequestStatus::Submitted, FuelRequestStatus::Withdrawn => throw ValidationException::withMessages(['status' => 'Unsupported fuel transition.']),
        };

        if (! $actor->can($permission->value) || (($next === FuelRequestStatus::Approved || $next === FuelRequestStatus::Rejected) && $fuel->requester_id === $actor->id)) {
            throw new AuthorizationException;
        }

        if (array_key_exists('receipt_path', $logDetails)) {
            throw ValidationException::withMessages(['receipt' => 'Receipt paths must be generated from an uploaded file.']);
        }

        if ($next === FuelRequestStatus::Logged && ($logDetails['receipt'] ?? null) instanceof UploadedFile) {
            return $this->handleLoggedWithReceipt($actor, $fuel, $logDetails);
        }

        return DB::transaction(function () use ($actor, $fuel, $next, $reason, $requiredPreviousStatus, $logDetails): FuelRequest {
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
                $this->createFuelLog($actor, $fuel, $logDetails);
                $this->updateAssetMeter($fuel, $logDetails);
            }

            $this->audit->handle($actor, $fuel, 'fuel.status_updated', $before, ['status' => $next->value], $reason);
            $this->notifier->statusChanged($fuel);

            return $fuel->refresh();
        });
    }

    /**
     * A log needs the receipt itself or an explicit, reviewable reason for its absence.
     *
     * @param  array<string, mixed>  $logDetails
     */
    private function assertReceiptOrException(array $logDetails): void
    {
        $reason = FuelNoReceiptReason::tryFrom(is_string($logDetails['no_receipt_reason'] ?? null) ? $logDetails['no_receipt_reason'] : '');

        if ($reason === null) {
            throw ValidationException::withMessages(['receipt' => 'Attach the fuel receipt, or choose why there is no receipt.']);
        }

        $note = is_string($logDetails['no_receipt_note'] ?? null) ? trim($logDetails['no_receipt_note']) : '';

        if ($reason === FuelNoReceiptReason::Other && $note === '') {
            throw ValidationException::withMessages(['no_receipt_note' => 'Explain why there is no receipt.']);
        }
    }

    /**
     * Store the log row first, upload the receipt without an open database
     * transaction, then finalize the request. A failed upload removes the
     * staged log so the verified request can be retried safely.
     *
     * @param  array<string, mixed>  $logDetails
     */
    private function handleLoggedWithReceipt(User $actor, FuelRequest $fuel, array $logDetails): FuelRequest
    {
        /** @var UploadedFile $receipt */
        $receipt = $logDetails['receipt'];
        $fuelLog = DB::transaction(function () use ($actor, $fuel, $logDetails): FuelLog {
            /** @var FuelRequest $lockedFuel */
            $lockedFuel = FuelRequest::query()->with('asset')->lockForUpdate()->findOrFail($fuel->id);

            if ($lockedFuel->status !== FuelRequestStatus::Verified) {
                throw ValidationException::withMessages(['status' => 'The fuel request is not at the required stage.']);
            }

            if ($lockedFuel->logs()->exists()) {
                throw ValidationException::withMessages(['status' => 'The fuel request has already been logged.']);
            }

            return $this->createFuelLog($actor, $lockedFuel, $logDetails);
        });

        $receiptAttachment = null;

        try {
            $receiptAttachment = $this->uploadAttachment->execute($actor, $fuelLog, $receipt, 'fuel_receipt');

            return DB::transaction(function () use ($actor, $fuel, $fuelLog, $receiptAttachment, $logDetails): FuelRequest {
                /** @var FuelRequest $lockedFuel */
                $lockedFuel = FuelRequest::query()->with('asset')->lockForUpdate()->findOrFail($fuel->id);
                /** @var FuelLog $lockedLog */
                $lockedLog = FuelLog::query()->lockForUpdate()->findOrFail($fuelLog->id);

                if ($lockedFuel->status !== FuelRequestStatus::Verified) {
                    throw ValidationException::withMessages(['status' => 'The fuel request is no longer ready for logging.']);
                }

                $before = ['status' => $lockedFuel->status->value];
                $lockedLog->update(['receipt_path' => $receiptAttachment->path]);
                $lockedFuel->update(['status' => FuelRequestStatus::Logged, 'decision_reason' => null]);
                $this->updateAssetMeter($lockedFuel, $logDetails);
                $this->audit->handle($actor, $lockedFuel, 'fuel.status_updated', $before, ['status' => FuelRequestStatus::Logged->value]);

                return $lockedFuel->refresh();
            });
        } catch (\Throwable $exception) {
            if ($receiptAttachment instanceof Attachment) {
                DB::transaction(fn () => Attachment::query()->whereKey($receiptAttachment->id)->delete());
                Storage::disk($receiptAttachment->disk)->delete($receiptAttachment->path);
            }

            DB::transaction(function () use ($fuel, $fuelLog): void {
                $lockedFuel = FuelRequest::query()->lockForUpdate()->find($fuel->id);

                if ($lockedFuel?->status === FuelRequestStatus::Verified) {
                    FuelLog::query()->whereKey($fuelLog->id)->delete();
                }
            });

            throw $exception;
        }
    }

    /** @param array<string, mixed> $logDetails */
    private function createFuelLog(User $actor, FuelRequest $fuel, array $logDetails): FuelLog
    {
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
                throw ValidationException::withMessages(['odometer_km' => "Odometer reading ({$odometerKm} km) cannot be less than current asset meter ({$asset->meter_value} km)."]);
            }

            if ($isHourMeter && $hourMeter !== null && $asset->meter_value !== null && $hourMeter < (float) $asset->meter_value) {
                throw ValidationException::withMessages(['hour_meter' => "Hour meter reading ({$hourMeter} hrs) cannot be less than current asset meter ({$asset->meter_value} hrs)."]);
            }
        }

        if (! (($logDetails['receipt'] ?? null) instanceof UploadedFile)) {
            $this->assertReceiptOrException($logDetails);
        }

        $varianceResult = $this->calculateVariance->execute($fuel, $quantityLitres, $odometerKm, $hourMeter);

        return FuelLog::query()->create([
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
            'receipt_number' => isset($logDetails['receipt_number']) && is_string($logDetails['receipt_number']) && trim($logDetails['receipt_number']) !== '' ? trim($logDetails['receipt_number']) : null,
            'no_receipt_reason' => ($logDetails['receipt'] ?? null) instanceof UploadedFile ? null : FuelNoReceiptReason::tryFrom(is_string($logDetails['no_receipt_reason'] ?? null) ? $logDetails['no_receipt_reason'] : '')?->value,
            'no_receipt_note' => ($logDetails['receipt'] ?? null) instanceof UploadedFile ? null : (isset($logDetails['no_receipt_note']) && is_string($logDetails['no_receipt_note']) && trim($logDetails['no_receipt_note']) !== '' ? trim($logDetails['no_receipt_note']) : null),
            'recorded_at' => now(),
        ]);
    }

    /** @param array<string, mixed> $logDetails */
    private function updateAssetMeter(FuelRequest $fuel, array $logDetails): void
    {
        $asset = $fuel->asset;
        if ($asset === null) {
            return;
        }

        $odometerKm = isset($logDetails['odometer_km']) && $logDetails['odometer_km'] !== '' ? (int) $logDetails['odometer_km'] : null;
        $hourMeter = isset($logDetails['hour_meter']) && $logDetails['hour_meter'] !== '' ? (float) $logDetails['hour_meter'] : null;
        $isOdometer = in_array($asset->meter_type, ['odometer', 'odometer_km'], true);
        $isHourMeter = in_array($asset->meter_type, ['hour_meter', 'engine_hours'], true);

        if ($isOdometer && $odometerKm !== null && ($asset->meter_value === null || $odometerKm > (float) $asset->meter_value)) {
            $asset->update(['meter_value' => $odometerKm]);
        } elseif ($isHourMeter && $hourMeter !== null && ($asset->meter_value === null || $hourMeter > (float) $asset->meter_value)) {
            $asset->update(['meter_value' => $hourMeter]);
        }
    }
}
