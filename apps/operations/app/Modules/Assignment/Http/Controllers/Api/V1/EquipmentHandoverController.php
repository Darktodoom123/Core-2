<?php

namespace App\Modules\Assignment\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Actions\ClaimEquipmentHandover;
use App\Modules\Assignment\Http\Requests\Api\V1\ClaimHandoverByUnitRequest;
use App\Modules\Assignment\Http\Requests\Api\V1\ClaimHandoverRequest;
use App\Modules\Assignment\Http\Requests\Api\V1\InitiateHandoverRequest;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

final class EquipmentHandoverController extends Controller
{
    public function initiate(
        InitiateHandoverRequest $request,
        DispatchJob $dispatchJob,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        /** @var DispatchPersonnelAssignment|null $activeAssignment */
        $activeAssignment = $dispatchJob->personnelAssignments()
            ->open()
            ->where('user_id', $actor->id)
            ->first();

        if ($activeAssignment === null) {
            return response()->json([
                'message' => 'You are not actively assigned to this dispatch job.',
            ], 403);
        }

        $assetAssignment = $dispatchJob->assetAssignments()->open()->with('asset')->first();
        $assetCode = $assetAssignment?->asset->code ?? 'UNSPECIFIED';

        $reliefOperator = null;
        if ($request->filled('relief_user_id')) {
            /** @var User|null $reliefUser */
            $reliefUser = User::query()->find($request->input('relief_user_id'));
            if ($reliefUser !== null) {
                $reliefOperator = [
                    'id' => $reliefUser->id,
                    'name' => $reliefUser->name,
                ];
            }
        }

        $handoverToken = (string) Str::uuid();
        $pin = sprintf('%04d', mt_rand(1000, 9999));
        $expiresAt = now()->addMinutes(15);

        $payload = [
            'dispatch_job_id' => $dispatchJob->id,
            'asset_code' => $assetCode,
            'outgoing_user_id' => $actor->id,
            'outgoing_user_name' => $actor->name,
            'relief_operator' => $reliefOperator,
            'handover_token' => $handoverToken,
            'pin' => $pin,
            'expires_at' => $expiresAt->toIso8601String(),
            'remarks' => $request->input('remarks'),
        ];

        ClaimEquipmentHandover::remember($payload, $expiresAt);

        return response()->json([
            'message' => 'Equipment handover initiated successfully.',
            'data' => $payload,
        ], 200);
    }

    public function claim(
        ClaimHandoverRequest $request,
        DispatchJob $dispatchJob,
        ClaimEquipmentHandover $action,
    ): JsonResponse {
        if (! $request->hasValidCredentials()) {
            return response()->json([
                'message' => 'Either handover_token or pin is required to claim equipment handover.',
            ], 422);
        }

        /** @var User $actor */
        $actor = $request->user();

        return $this->claimed($action->byJob(
            $actor,
            $dispatchJob,
            $request->input('handover_token'),
            $request->input('pin'),
        ));
    }

    /** A relief operator with no job on their phone claims by unit code and PIN. */
    public function claimByUnit(ClaimHandoverByUnitRequest $request, ClaimEquipmentHandover $action): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        return $this->claimed($action->byUnit(
            $actor,
            (string) $request->validated('asset_code'),
            (string) $request->validated('pin'),
        ));
    }

    /** @param array<string, mixed> $data */
    private function claimed(array $data): JsonResponse
    {
        return response()->json([
            'message' => 'Equipment handover claimed successfully. Asset bound to relief operator.',
            'data' => $data,
        ], 200);
    }
}
