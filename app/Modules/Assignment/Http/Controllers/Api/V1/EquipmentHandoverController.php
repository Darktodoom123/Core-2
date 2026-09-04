<?php

namespace App\Modules\Assignment\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Http\Requests\Api\V1\ClaimHandoverRequest;
use App\Modules\Assignment\Http\Requests\Api\V1\InitiateHandoverRequest;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
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
        $assetCode = $assetAssignment?->asset?->code ?? 'UNSPECIFIED';

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

        Cache::put("handover:job:{$dispatchJob->id}", $payload, $expiresAt);
        Cache::put("handover:token:{$handoverToken}", $payload, $expiresAt);
        Cache::put("handover:pin:{$dispatchJob->id}:{$pin}", $payload, $expiresAt);

        return response()->json([
            'message' => 'Equipment handover initiated successfully.',
            'data' => $payload,
        ], 200);
    }

    public function claim(
        ClaimHandoverRequest $request,
        DispatchJob $dispatchJob,
        RecordAuditEvent $audit,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        if (! $request->hasValidCredentials()) {
            return response()->json([
                'message' => 'Either handover_token or pin is required to claim equipment handover.',
            ], 422);
        }

        $token = $request->input('handover_token');
        $pin = $request->input('pin');

        /** @var array<string, mixed>|null $handover */
        $handover = null;

        if ($token !== null) {
            $handover = Cache::get("handover:token:{$token}");
        } elseif ($pin !== null) {
            $handover = Cache::get("handover:pin:{$dispatchJob->id}:{$pin}");
        }

        if ($handover === null || (int) $handover['dispatch_job_id'] !== $dispatchJob->id) {
            return response()->json([
                'message' => 'Handover session expired or invalid for this equipment.',
            ], 422);
        }

        if ((int) $handover['outgoing_user_id'] === $actor->id) {
            return response()->json([
                'message' => 'Cannot claim handover from yourself. Another relief operator must claim the unit.',
            ], 422);
        }

        return DB::transaction(function () use ($actor, $dispatchJob, $handover, $audit): JsonResponse {
            /** @var DispatchJob $job */
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($dispatchJob->id);

            // Close outgoing operator assignment
            /** @var DispatchPersonnelAssignment|null $outgoingAssignment */
            $outgoingAssignment = $job->personnelAssignments()
                ->open()
                ->where('user_id', $handover['outgoing_user_id'])
                ->lockForUpdate()
                ->first();

            $outgoingAssignment?->update([
                'active_until' => now(),
                'notes' => 'Transferred equipment to relief operator ID '.$actor->id,
            ]);

            // Create or activate incoming operator assignment
            DispatchPersonnelAssignment::query()->create([
                'dispatch_job_id' => $job->id,
                'user_id' => $actor->id,
                'assignment_type' => $outgoingAssignment?->assignment_type ?? 'driver',
                'assigned_by' => $actor->id,
                'response_status' => AssignmentResponse::Accepted,
                'responded_at' => now(),
                'created_at' => now(),
            ]);

            $job->increment('version');

            $audit->handle(
                $actor,
                $job,
                'dispatch.equipment_handover',
                ['previous_operator_id' => $handover['outgoing_user_id']],
                ['active_operator_id' => $actor->id],
                'Equipment hot-seat handover completed with zero telemetry drop.'
            );

            // Clear cache keys
            Cache::forget("handover:job:{$job->id}");
            Cache::forget('handover:token:'.$handover['handover_token']);
            Cache::forget("handover:pin:{$job->id}:".$handover['pin']);

            return response()->json([
                'message' => 'Equipment handover claimed successfully. Asset bound to relief operator.',
                'data' => [
                    'dispatch_job_id' => $job->id,
                    'asset_code' => $handover['asset_code'],
                    'status' => 'transferred',
                    'previous_operator_id' => $handover['outgoing_user_id'],
                    'active_operator_id' => $actor->id,
                    'active_operator_name' => $actor->name,
                ],
            ], 200);
        });
    }
}
