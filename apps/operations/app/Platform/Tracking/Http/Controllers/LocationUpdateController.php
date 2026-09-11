<?php

namespace App\Platform\Tracking\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Tracking\Actions\BroadcastTrackingWorkspaceUpdate;
use App\Platform\Tracking\Contracts\TrackingClientInterface;
use App\Platform\Tracking\Data\LocationSampleDto;
use App\Platform\Tracking\Exceptions\TrackingConflictException;
use App\Platform\Tracking\Http\Requests\StoreLocationUpdateRequest;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Tracking\Testing\FakeTrackingClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

final class LocationUpdateController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::TrackingViewAll->value);

        return response()->json([
            'data' => LocationUpdate::query()
                ->with(['user:id,name', 'asset:id,code,name,location', 'job:id,reference,title,site'])
                ->latest('captured_at')
                ->paginate(100),
        ]);
    }

    public function store(
        StoreLocationUpdateRequest $request,
        IdempotentCommandService $idempotency,
        RecordAuditEvent $audit,
        BroadcastTrackingWorkspaceUpdate $broadcast,
        TrackingClientInterface $trackingClient,
    ): RedirectResponse|JsonResponse {
        $commandId = $request->header('Idempotency-Key') ?: $request->input('command_id');

        $execute = function () use ($request, $audit, $broadcast, $trackingClient, $commandId) {
            $data = $request->validated();
            unset($data['command_id']);

            $sample = LocationSampleDto::fromArray([
                'command_id' => is_string($commandId) ? $commandId : null,
                'user_id' => $request->user()->id,
                'operational_asset_id' => $data['operational_asset_id'] ?? null,
                'dispatch_job_id' => $data['dispatch_job_id'] ?? null,
                'latitude' => $data['latitude'] ?? null,
                'longitude' => $data['longitude'] ?? null,
                'accuracy_metres' => $data['accuracy_metres'] ?? null,
                'speed' => $data['speed'] ?? null,
                'remarks' => $data['remarks'] ?? null,
                'source' => 'browser',
                'sharing_enabled' => (bool) ($data['sharing_enabled'] ?? true),
                'captured_at' => $data['captured_at'] ?? now(),
                'received_at' => now(),
            ]);

            try {
                $latest = $trackingClient->ingestLocation($sample);
            } catch (TrackingConflictException $e) {
                if ($request->wantsJson()) {
                    return response()->json([
                        'message' => $e->getMessage(),
                        'error' => 'conflict',
                    ], 409);
                }

                return back()->withErrors(['command_id' => $e->getMessage()])->withInput();
            }

            if ($trackingClient instanceof FakeTrackingClient) {
                LocationUpdate::query()->create([
                    ...$data,
                    'user_id' => $request->user()->id,
                    'source' => 'browser',
                    'received_at' => now(),
                ]);
            }

            $sharingEnabled = (bool) $data['sharing_enabled'];
            $audit->handle(
                $request->user(),
                $request->user(),
                $sharingEnabled ? 'tracking.location_shared' : 'tracking.location_sharing_paused',
                null,
                [
                    'sharing_enabled' => $sharingEnabled,
                    'captured_at' => $latest->capturedAt?->toIso8601String(),
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
                collect($request->validated())->except('command_id')->all(),
                wrapInTransaction: false,
            );
        }

        return $execute();
    }
}
