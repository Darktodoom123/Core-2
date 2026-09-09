<?php

namespace App\Modules\HoursOfService\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\HoursOfService\Actions\CertifyAndCompleteShiftAction;
use App\Modules\HoursOfService\Actions\RecordDutyStatusTransitionAction;
use App\Modules\HoursOfService\Actions\StartOperatorShiftAction;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\StandbyReason;
use App\Modules\HoursOfService\Http\Requests\Api\V1\CertifyShiftRequest;
use App\Modules\HoursOfService\Http\Requests\Api\V1\ChangeDutyStatusRequest;
use App\Modules\HoursOfService\Http\Requests\Api\V1\StartShiftRequest;
use App\Modules\HoursOfService\Http\Resources\V1\DutyLogResource;
use App\Modules\HoursOfService\Http\Resources\V1\HosShiftResource;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Modules\HoursOfService\Queries\CalculateHosClocksQuery;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class HosShiftController extends Controller
{
    public function currentShift(Request $request, CalculateHosClocksQuery $clocksQuery): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $clocks = $clocksQuery->execute($user);

        /** @var OperatorShift|null $activeShift */
        $activeShift = OperatorShift::query()
            ->with(['dutyLogs', 'activeDutyLog'])
            ->where('user_id', $user->id)
            ->latest('started_at')
            ->first();

        return response()->json([
            'data' => [
                'shift' => $activeShift !== null ? new HosShiftResource($activeShift) : null,
                'clocks' => $clocks,
            ],
        ]);
    }

    public function startShift(
        StartShiftRequest $request,
        StartOperatorShiftAction $action,
        IdempotentCommandService $idempotency,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $commandId = $idempotency->resolveCommandId($request, required: false);

        $execute = function () use ($request, $user, $action): JsonResponse {
            $validated = $request->validated();

            $initialDuty = isset($validated['duty_status'])
                ? DutyStatus::from($validated['duty_status'])
                : DutyStatus::OPERATING;

            $shift = $action->execute(
                user: $user,
                operationalAssetId: $validated['operational_asset_id'] ?? null,
                dispatchJobId: $validated['dispatch_job_id'] ?? null,
                initialDutyStatus: $initialDuty,
                latitude: isset($validated['latitude']) ? (float) $validated['latitude'] : null,
                longitude: isset($validated['longitude']) ? (float) $validated['longitude'] : null,
                locationName: $validated['location_name'] ?? null,
                remarks: $validated['remarks'] ?? null,
            );

            return response()->json([
                'message' => 'Shift started successfully.',
                'data' => new HosShiftResource($shift),
            ], 201);
        };

        if ($commandId !== null) {
            /** @var JsonResponse */
            return $idempotency->process(
                $user,
                $commandId,
                'hos.start_shift',
                null,
                $execute,
                collect($request->validated())->except('command_id')->all(),
            );
        }

        return $execute();
    }

    public function changeDutyStatus(
        ChangeDutyStatusRequest $request,
        RecordDutyStatusTransitionAction $action,
        CalculateHosClocksQuery $clocksQuery,
        IdempotentCommandService $idempotency,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $commandId = $idempotency->resolveCommandId($request, required: false);

        $execute = function () use ($request, $user, $action, $clocksQuery): JsonResponse {
            $dutyStatus = DutyStatus::from((string) $request->input('duty_status'));
            $standbyReasonInput = $request->input('standby_reason');
            $standbyReason = $standbyReasonInput ? StandbyReason::from((string) $standbyReasonInput) : null;

            $shift = $action->execute(
                user: $user,
                nextStatus: $dutyStatus,
                standbyReason: $standbyReason,
                latitude: $request->filled('latitude') ? (float) $request->input('latitude') : null,
                longitude: $request->filled('longitude') ? (float) $request->input('longitude') : null,
                locationName: $request->input('location_name'),
                remarks: $request->input('remarks'),
            );

            $clocks = $clocksQuery->execute($user);

            return response()->json([
                'message' => 'Duty status updated successfully.',
                'data' => [
                    'shift' => new HosShiftResource($shift),
                    'clocks' => $clocks,
                ],
            ]);
        };

        if ($commandId !== null) {
            /** @var JsonResponse */
            return $idempotency->process(
                $user,
                $commandId,
                'hos.change_duty_status',
                null,
                $execute,
                collect($request->validated())->except('command_id')->all(),
            );
        }

        return $execute();
    }

    public function certifyShift(
        CertifyShiftRequest $request,
        CertifyAndCompleteShiftAction $action,
        CalculateHosClocksQuery $clocksQuery,
        IdempotentCommandService $idempotency,
    ): JsonResponse {
        /** @var User $user */
        $user = $request->user();

        $commandId = $idempotency->resolveCommandId($request, required: false);

        $execute = function () use ($request, $user, $action, $clocksQuery): JsonResponse {
            $shift = $action->execute(
                user: $user,
                certificationStatement: (string) $request->input('certification_statement'),
                remarks: $request->input('remarks'),
            );

            $clocks = $clocksQuery->execute($user);

            return response()->json([
                'message' => 'Shift certified and completed successfully.',
                'data' => [
                    'shift' => new HosShiftResource($shift),
                    'clocks' => $clocks,
                ],
            ]);
        };

        if ($commandId !== null) {
            /** @var JsonResponse */
            return $idempotency->process(
                $user,
                $commandId,
                'hos.certify_shift',
                null,
                $execute,
                collect($request->validated())->except('command_id')->all(),
            );
        }

        return $execute();
    }

    public function cycleHistory(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $days = (int) $request->query('days', 8);
        $startDate = Carbon::now()->subDays($days)->startOfDay();

        $logs = OperatorDutyLog::query()
            ->where('user_id', $user->id)
            ->where('started_at', '>=', $startDate)
            ->orderBy('started_at', 'desc')
            ->get();

        $shifts = OperatorShift::query()
            ->with(['dutyLogs'])
            ->where('user_id', $user->id)
            ->where('started_at', '>=', $startDate)
            ->orderBy('started_at', 'desc')
            ->get();

        return response()->json([
            'data' => [
                'days' => $days,
                'shifts' => HosShiftResource::collection($shifts),
                'logs' => DutyLogResource::collection($logs),
            ],
        ]);
    }
}
