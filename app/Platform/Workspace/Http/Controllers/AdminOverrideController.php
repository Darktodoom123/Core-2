<?php

namespace App\Platform\Workspace\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Notifications\Models\Notification;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class AdminOverrideController extends Controller
{
    public function emergencyAbortDispatch(Request $request, DispatchJob $dispatchJob, RecordAuditEvent $audit): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->hasRole(RoleName::SystemAdministrator->value) || $actor->can(PermissionName::SystemConfigure->value), 403);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:6', 'max:500'],
        ]);

        $beforeState = [
            'status' => $dispatchJob->status->value,
            'cancellation_reason' => $dispatchJob->cancellation_reason,
            'version' => $dispatchJob->version,
        ];

        DB::transaction(function () use ($dispatchJob, $actor, $validated, $beforeState, $audit): void {
            /** @var DispatchJob $job */
            $job = DispatchJob::query()->lockForUpdate()->findOrFail($dispatchJob->id);

            // 1. Release active personnel assignments
            DispatchPersonnelAssignment::query()
                ->where('dispatch_job_id', $job->id)
                ->whereNull('active_until')
                ->update(['active_until' => now()]);

            // 2. Release active asset assignments and reset asset status to Available
            $activeAssetAssignments = DispatchAssetAssignment::query()
                ->where('dispatch_job_id', $job->id)
                ->whereNull('active_until')
                ->get();

            foreach ($activeAssetAssignments as $assignment) {
                $assignment->update(['active_until' => now()]);
                OperationalAsset::query()
                    ->where('id', $assignment->operational_asset_id)
                    ->update(['status' => AssetStatus::Available->value]);
            }

            // 3. Set dispatch job status to cancelled with audit flag
            $job->status = DispatchStatus::Cancelled;
            $job->cancelled_by = $actor->id;
            $job->cancellation_reason = '[EMERGENCY ADMIN OVERRIDE] '.$validated['reason'];
            $job->version += 1;
            $job->save();

            // 4. Record Audit Event
            $audit->handle(
                actor: $actor,
                subject: $job,
                action: 'dispatch.emergency_abort',
                before: $beforeState,
                after: [
                    'status' => $job->status->value,
                    'cancellation_reason' => $job->cancellation_reason,
                    'version' => $job->version,
                ],
                reason: $validated['reason']
            );

            // 5. Broadcast notification
            Notification::query()->create([
                'notifiable_type' => $actor->getMorphClass(),
                'notifiable_id' => $actor->id,
                'dispatch_job_id' => $job->id,
                'type' => 'dispatch_emergency_aborted',
                'status' => 'unread',
                'data' => [
                    'title' => 'Dispatch Emergency Aborted',
                    'message' => "Job {$job->reference} was force-aborted by Administrator {$actor->name}.",
                    'reason' => $validated['reason'],
                ],
            ]);
        });

        return response()->json([
            'message' => 'Dispatch job force-aborted successfully. All assigned personnel and equipment have been released.',
            'job' => $dispatchJob->refresh(),
        ]);
    }

    public function safetyLockdownAsset(Request $request, OperationalAsset $asset, RecordAuditEvent $audit): JsonResponse
    {
        $actor = $request->user();
        abort_unless(
            $actor->hasRole(RoleName::SystemAdministrator->value)
            || $actor->hasRole(RoleName::SafetyOfficer->value)
            || $actor->can(PermissionName::SystemConfigure->value),
            403
        );

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:6', 'max:500'],
        ]);

        $beforeState = [
            'status' => $asset->status->value,
        ];

        DB::transaction(function () use ($asset, $actor, $validated, $beforeState, $audit): void {
            /** @var OperationalAsset $lockedAsset */
            $lockedAsset = OperationalAsset::query()->lockForUpdate()->findOrFail($asset->id);

            // 1. Release any active dispatch assignment
            DispatchAssetAssignment::query()
                ->where('operational_asset_id', $lockedAsset->id)
                ->whereNull('active_until')
                ->update(['active_until' => now()]);

            // 2. Set asset status to Unavailable (Lockdown)
            $lockedAsset->status = AssetStatus::Unavailable;
            $lockedAsset->save();

            // 3. Record Audit Event
            $audit->handle(
                actor: $actor,
                subject: $lockedAsset,
                action: 'asset.safety_lockdown',
                before: $beforeState,
                after: ['status' => $lockedAsset->status->value],
                reason: $validated['reason']
            );
        });

        return response()->json([
            'message' => "Asset {$asset->code} placed on Emergency Safety Lockdown. Assignment eligibility revoked.",
            'asset' => $asset->refresh(),
        ]);
    }
}
