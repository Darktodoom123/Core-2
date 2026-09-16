<?php

namespace Tracking\Http\Controllers\Api\Internal;

use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Tracking\Http\Requests\IngestLocationRequest;
use Tracking\Models\LatestLocation;
use Tracking\Models\LocationSample;
use Tracking\Models\TrackingCommandReceipt;

final class LocationController extends Controller
{
    public function ingest(IngestLocationRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $commandId = $validated['command_id']
            ?? $request->header('X-Command-Id')
            ?? $request->header('Idempotency-Key');

        $userId = (int) $validated['user_id'];
        $assetId = isset($validated['operational_asset_id']) ? (int) $validated['operational_asset_id'] : null;
        $jobId = isset($validated['dispatch_job_id']) ? (int) $validated['dispatch_job_id'] : null;
        $sharingEnabled = isset($validated['sharing_enabled']) ? (bool) $validated['sharing_enabled'] : true;

        $rawLat = isset($validated['latitude']) ? round((float) $validated['latitude'], 7) : null;
        $rawLng = isset($validated['longitude']) ? round((float) $validated['longitude'], 7) : null;

        $now = CarbonImmutable::now();
        $capturedAt = isset($validated['captured_at'])
            ? CarbonImmutable::parse($validated['captured_at'])
            : $now;
        $receivedAt = isset($validated['received_at'])
            ? CarbonImmutable::parse($validated['received_at'])
            : $now;

        $retentionCutoff = $now->subDays(30);
        $isExpiredByRetention = $capturedAt->lessThan($retentionCutoff);

        $lat = ($sharingEnabled && ! $isExpiredByRetention) ? $rawLat : null;
        $lng = ($sharingEnabled && ! $isExpiredByRetention) ? $rawLng : null;

        $canonicalPayload = [
            'user_id' => $userId,
            'operational_asset_id' => $assetId,
            'dispatch_job_id' => $jobId,
            'latitude' => $rawLat,
            'longitude' => $rawLng,
            'accuracy_metres' => isset($validated['accuracy_metres']) ? round((float) $validated['accuracy_metres'], 2) : null,
            'speed' => isset($validated['speed']) ? round((float) $validated['speed'], 2) : null,
            'remarks' => isset($validated['remarks']) ? (string) $validated['remarks'] : null,
            'source' => (string) ($validated['source'] ?? 'mobile'),
            'sharing_enabled' => $sharingEnabled,
            'captured_at' => isset($validated['captured_at']) ? $capturedAt->toIso8601String() : null,
        ];
        ksort($canonicalPayload);
        $payloadHash = hash('sha256', json_encode($canonicalPayload, JSON_THROW_ON_ERROR));

        if (is_string($commandId) && $commandId !== '') {
            $receipt = TrackingCommandReceipt::query()->where('command_id', $commandId)->first();
            if ($receipt !== null) {
                if ($receipt->payload_hash !== null && ! hash_equals($receipt->payload_hash, $payloadHash)) {
                    return response()->json([
                        'message' => 'This command ID was already used for a different command payload.',
                        'error' => 'conflict',
                    ], 409);
                }

                if (is_array($receipt->response_payload)) {
                    return response()->json($receipt->response_payload, $receipt->status_code);
                }
            }
        }

        $sampleData = [
            'user_id' => $userId,
            'operational_asset_id' => $assetId,
            'dispatch_job_id' => $jobId,
            'latitude' => $lat,
            'longitude' => $lng,
            'accuracy_metres' => ($sharingEnabled && ! $isExpiredByRetention && isset($validated['accuracy_metres'])) ? (float) $validated['accuracy_metres'] : null,
            'speed' => ($sharingEnabled && ! $isExpiredByRetention && isset($validated['speed'])) ? (float) $validated['speed'] : null,
            'remarks' => isset($validated['remarks']) ? (string) $validated['remarks'] : null,
            'source' => (string) ($validated['source'] ?? 'mobile'),
            'sharing_enabled' => $sharingEnabled,
            'command_id' => is_string($commandId) && $commandId !== '' ? $commandId : null,
            'captured_at' => $capturedAt,
            'received_at' => $receivedAt,
        ];

        try {
            /** @var array{payload: array<string, mixed>, status: int} $result */
            $result = DB::transaction(function () use ($sampleData, $userId, $assetId, $jobId, $sharingEnabled, $isExpiredByRetention, $lat, $lng, $capturedAt, $receivedAt, $commandId, $payloadHash) {
                $sample = LocationSample::query()->create($sampleData);

                // Determine user IDs requiring row locks, sorted in ascending order to prevent deadlocks under concurrency
                $existingHolderUserId = null;
                if ($assetId !== null) {
                    $existingHolderUserId = LatestLocation::query()
                        ->where('operational_asset_id', $assetId)
                        ->where('user_id', '!=', $userId)
                        ->value('user_id');
                }

                $userIdsToLock = [$userId];
                if ($existingHolderUserId !== null) {
                    $userIdsToLock[] = (int) $existingHolderUserId;
                    sort($userIdsToLock, SORT_NUMERIC);
                }

                $lockedProjections = [];
                foreach ($userIdsToLock as $idToLock) {
                    $proj = LatestLocation::query()
                        ->where('user_id', $idToLock)
                        ->lockForUpdate()
                        ->first();
                    if ($proj !== null) {
                        $lockedProjections[$idToLock] = $proj;
                    }
                }

                $existingProjection = $lockedProjections[$userId] ?? null;
                $existingAssetHolder = ($existingHolderUserId !== null) ? ($lockedProjections[(int) $existingHolderUserId] ?? null) : null;

                $effectiveAssetId = $assetId;
                if ($existingAssetHolder !== null) {
                    $holderCapturedAt = $existingAssetHolder->captured_at;
                    if ($holderCapturedAt !== null && $holderCapturedAt->greaterThan($capturedAt)) {
                        $effectiveAssetId = null;
                    }
                }

                /** @var LatestLocation|null $latestProjection */
                $latestProjection = null;

                if ($existingProjection === null) {
                    try {
                        $latestProjection = DB::transaction(function () use ($userId, $effectiveAssetId, $jobId, $sample, $sharingEnabled, $isExpiredByRetention, $lat, $lng, $capturedAt, $receivedAt) {
                            return LatestLocation::query()->create([
                                'user_id' => $userId,
                                'operational_asset_id' => $effectiveAssetId,
                                'dispatch_job_id' => $jobId,
                                'location_sample_id' => $sample->id,
                                'latitude' => ($sharingEnabled && ! $isExpiredByRetention) ? $lat : null,
                                'longitude' => ($sharingEnabled && ! $isExpiredByRetention) ? $lng : null,
                                'accuracy_metres' => ($sharingEnabled && ! $isExpiredByRetention) ? $sample->accuracy_metres : null,
                                'speed' => ($sharingEnabled && ! $isExpiredByRetention) ? $sample->speed : null,
                                'remarks' => $sample->remarks,
                                'source' => $sample->source,
                                'sharing_enabled' => $sharingEnabled,
                                'command_id' => $sample->command_id,
                                'captured_at' => $capturedAt,
                                'received_at' => $receivedAt,
                            ]);
                        });

                        if ($effectiveAssetId !== null) {
                            LatestLocation::query()
                                ->where('operational_asset_id', $effectiveAssetId)
                                ->where('user_id', '!=', $userId)
                                ->update(['operational_asset_id' => null]);
                        }
                    } catch (QueryException) {
                        $existingProjection = LatestLocation::query()
                            ->where('user_id', $userId)
                            ->lockForUpdate()
                            ->first();
                    }
                }

                if ($existingProjection !== null) {
                    $existingCapturedAt = $existingProjection->captured_at;
                    $isNewer = $existingCapturedAt === null || $capturedAt->greaterThanOrEqualTo($existingCapturedAt);

                    $canUpdateSharing = $isNewer;
                    if (! $existingProjection->sharing_enabled && $sharingEnabled) {
                        $canUpdateSharing = $existingCapturedAt === null || $capturedAt->greaterThan($existingCapturedAt);
                    }

                    if ($isNewer) {
                        if ($effectiveAssetId !== null) {
                            LatestLocation::query()
                                ->where('operational_asset_id', $effectiveAssetId)
                                ->where('user_id', '!=', $userId)
                                ->update(['operational_asset_id' => null]);
                        }

                        $effectiveSharing = $canUpdateSharing ? $sharingEnabled : false;
                        $existingProjection->update([
                            'operational_asset_id' => $effectiveAssetId,
                            'dispatch_job_id' => $jobId,
                            'location_sample_id' => $sample->id,
                            'latitude' => ($effectiveSharing && ! $isExpiredByRetention) ? $lat : null,
                            'longitude' => ($effectiveSharing && ! $isExpiredByRetention) ? $lng : null,
                            'accuracy_metres' => ($effectiveSharing && ! $isExpiredByRetention) ? $sample->accuracy_metres : null,
                            'speed' => ($effectiveSharing && ! $isExpiredByRetention) ? $sample->speed : null,
                            'remarks' => $sample->remarks,
                            'source' => $sample->source,
                            'sharing_enabled' => $effectiveSharing,
                            'command_id' => $sample->command_id,
                            'captured_at' => $capturedAt,
                            'received_at' => $receivedAt,
                        ]);
                    }

                    $latestProjection = $existingProjection;
                }

                if (! $latestProjection instanceof LatestLocation) {
                    $latestProjection = LatestLocation::query()
                        ->where('user_id', $userId)
                        ->firstOrFail();
                }

                $responsePayload = [
                    'data' => $latestProjection->toDtoArray(),
                ];

                if (is_string($commandId) && $commandId !== '') {
                    TrackingCommandReceipt::query()->create([
                        'command_id' => $commandId,
                        'action' => 'telemetry.ingest',
                        'payload_hash' => $payloadHash,
                        'user_id' => $userId,
                        'location_sample_id' => $sample->id,
                        'status_code' => 201,
                        'response_payload' => $responsePayload,
                        'received_at' => $receivedAt,
                    ]);
                }

                return [
                    'payload' => $responsePayload,
                    'status' => 201,
                ];
            });
        } catch (QueryException $e) {
            if (is_string($commandId) && $commandId !== '') {
                $existing = TrackingCommandReceipt::query()->where('command_id', $commandId)->first();
                if ($existing !== null) {
                    if ($existing->payload_hash !== null && ! hash_equals($existing->payload_hash, $payloadHash)) {
                        return response()->json([
                            'message' => 'This command ID was already used for a different command payload.',
                            'error' => 'conflict',
                        ], 409);
                    }

                    if (is_array($existing->response_payload)) {
                        return response()->json($existing->response_payload, $existing->status_code);
                    }
                }
            }

            throw $e;
        }

        return response()->json($result['payload'], $result['status']);
    }

    public function latest(Request $request): JsonResponse
    {
        $query = LatestLocation::query();

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->input('user_id'));
        }

        $assetId = $request->input('operational_asset_id') ?? $request->input('asset_id');
        if ($assetId !== null && $assetId !== '') {
            $query->where('operational_asset_id', (int) $assetId);
        }

        $jobId = $request->input('dispatch_job_id') ?? $request->input('job_id');
        if ($jobId !== null && $jobId !== '') {
            $query->where('dispatch_job_id', (int) $jobId);
        }

        $limit = min(max((int) ($request->input('limit') ?? 500), 1), 1000);

        $records = $query
            ->orderByDesc('received_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->get();

        $data = $records->map(fn (LatestLocation $location): array => $location->toDtoArray())->values();

        return response()->json(['data' => $data]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = LocationSample::query();

        if ($request->filled('user_id')) {
            $query->where('user_id', (int) $request->input('user_id'));
        }

        $assetId = $request->input('operational_asset_id') ?? $request->input('asset_id');
        if ($assetId !== null && $assetId !== '') {
            $query->where('operational_asset_id', (int) $assetId);
        }

        $jobId = $request->input('dispatch_job_id') ?? $request->input('job_id');
        if ($jobId !== null && $jobId !== '') {
            $query->where('dispatch_job_id', (int) $jobId);
        }

        $dateFrom = $request->input('date_from') ?? $request->input('from');
        if (is_string($dateFrom) && $dateFrom !== '') {
            try {
                $query->where('captured_at', '>=', CarbonImmutable::parse($dateFrom));
            } catch (\Throwable) {
                // Ignore invalid date format
            }
        }

        $dateTo = $request->input('date_to') ?? $request->input('to');
        if (is_string($dateTo) && $dateTo !== '') {
            try {
                $query->where('captured_at', '<=', CarbonImmutable::parse($dateTo));
            } catch (\Throwable) {
                // Ignore invalid date format
            }
        }

        $orderBy = (string) ($request->input('order_by') ?? 'captured_at');
        if (! in_array($orderBy, ['captured_at', 'received_at', 'id', 'created_at'], true)) {
            $orderBy = 'captured_at';
        }

        $orderDirection = strtolower((string) ($request->input('order_direction') ?? $request->input('order') ?? 'desc')) === 'asc'
            ? 'asc'
            : 'desc';

        $limit = min(max((int) ($request->input('limit') ?? $request->input('per_page') ?? 100), 1), 1000);
        $page = max((int) ($request->input('page') ?? 1), 1);
        $offset = $request->filled('offset')
            ? max((int) $request->input('offset'), 0)
            : ($page - 1) * $limit;

        $samples = $query
            ->orderBy($orderBy, $orderDirection)
            ->offset($offset)
            ->limit($limit)
            ->get();

        $data = $samples->map(fn (LocationSample $sample): array => [
            'id' => $sample->id,
            'user_id' => $sample->user_id,
            'operational_asset_id' => $sample->operational_asset_id,
            'dispatch_job_id' => $sample->dispatch_job_id,
            'latitude' => $sample->latitude !== null ? (float) $sample->latitude : null,
            'longitude' => $sample->longitude !== null ? (float) $sample->longitude : null,
            'accuracy_metres' => $sample->accuracy_metres !== null ? (float) $sample->accuracy_metres : null,
            'speed' => $sample->speed !== null ? (float) $sample->speed : null,
            'remarks' => $sample->remarks,
            'source' => $sample->source,
            'sharing_enabled' => (bool) $sample->sharing_enabled,
            'command_id' => $sample->command_id,
            'captured_at' => $sample->captured_at?->toIso8601String(),
            'received_at' => $sample->received_at?->toIso8601String(),
        ])->values();

        return response()->json(['data' => $data]);
    }
}
