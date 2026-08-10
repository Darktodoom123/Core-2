<?php

namespace App\Platform\Tracking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Tracking\Actions\BroadcastTrackingWorkspaceUpdate;
use App\Platform\Tracking\Http\Requests\StoreLocationUpdateRequest;
use App\Platform\Tracking\Models\LocationUpdate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;

final class LocationUpdateController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::TrackingViewAll->value);

        return response()->json([
            'data' => LocationUpdate::query()
                ->with(['user:id,name', 'asset:id,code,name', 'job:id,reference,title'])
                ->latest('captured_at')
                ->paginate(100),
        ]);
    }

    public function store(
        StoreLocationUpdateRequest $request,
        IdempotentCommandService $idempotency,
        RecordAuditEvent $audit,
        BroadcastTrackingWorkspaceUpdate $broadcast,
    ): RedirectResponse|JsonResponse {
        $commandId = $request->header('Idempotency-Key') ?: $request->input('command_id');

        $execute = function () use ($request, $audit, $broadcast) {
            $data = $request->validated();
            unset($data['command_id']);

            $location = LocationUpdate::query()->create([
                ...$data,
                'user_id' => $request->user()->id,
                'source' => 'browser',
                'received_at' => now(),
            ]);

            $sharingEnabled = (bool) $data['sharing_enabled'];
            $audit->handle(
                $request->user(),
                $location,
                $sharingEnabled ? 'tracking.location_shared' : 'tracking.location_sharing_paused',
                null,
                [
                    'sharing_enabled' => $sharingEnabled,
                    'captured_at' => $location->captured_at?->toIso8601String(),
                ],
            );
            $broadcast->afterCommit();

            return to_route('home')->with('flash', [
                'tone' => 'success',
                'message' => 'Your current location was shared.',
            ]);
        };

        if ($commandId) {
            /** @var RedirectResponse|JsonResponse */
            return $idempotency->process(
                $request->user(),
                (string) $commandId,
                'location.store',
                null,
                $execute,
                collect($request->validated())->except('command_id')->all()
            );
        }

        return DB::transaction($execute);
    }
}
