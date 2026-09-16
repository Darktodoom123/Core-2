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

        $lat = $sharingEnabled ? $rawLat : null;
        $lng = $sharingEnabled ? $rawLng : null;

        $canonicalPayload = [
            'user_id' => $userId,
            'operational_asset_id' => $assetId,
            'dispatch_job_id' => $jobId,
            'latitude' => $lat,
            'longitude' => $lng,
            'accuracy_metres' => isset($validated['accuracy_metres']) ? (float) $validated['accuracy_metres'] : null,
            'speed' => isset($validated['speed']) ? (float) $validated['speed'] : null,
            'remarks' => isset($validated['remarks']) ? (string) $validated['remarks'] : null,
            'source' => (string) ($validated['source'] ?? 'mobile'),
            'sharing_enabled' => $sharingEnabled,
            'captured_at' => isset($validated['captured_at']) ? (string) $validated['captured_at'] : null,
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

        $now = CarbonImmutable::now();
        $capturedAt = isset($validated['captured_at'])
            ? CarbonImmutable::parse($validated['captured_at'])
            : $now;
        $receivedAt = isset($validated['received_at'])
            ? CarbonImmutable::parse($validated['received_at'])
            : $now;

        $sampleData = [
            'user_id' => $userId,
            'operational_asset_id' => $assetId,
            'dispatch_job_id' => $jobId,
            'latitude' => $lat,
            'longitude' => $lng,
            'accuracy_metres' => $sharingEnabled && isset($validated['accuracy_metres']) ? (float) $validated['accuracy_metres'] : null,
            'speed' => $sharingEnabled && isset($validated['speed']) ? (float) $validated['speed'] : null,
            'remarks' => isset($validated['remarks']) ? (string) $validated['remarks'] : null,
            'source' => (string) ($validated['source'] ?? 'mobile'),
            'sharing_enabled' => $sharingEnabled,
            'command_id' => is_string($commandId) && $commandId !== '' ? $commandId : null,
            'captured_at' => $capturedAt,
            'received_at' => $receivedAt,
        ];

        /** @var array{payload: array<string, mixed>, status: int} $result */
        $result = DB::transaction(function () use ($sampleData, $userId, $assetId, $jobId, $sharingEnabled, $lat, $lng, $capturedAt, $receivedAt, $commandId, $payloadHash) {
            $sample = LocationSample::query()->create($sampleData);

            if ($assetId !== null) {
                $existingAssetProjection = LatestLocation::query()
                    ->where('operational_asset_id', $assetId)
                    ->where('user_id', '!=', $userId)
                    ->first();

                if ($existingAssetProjection !== null) {
                    $existingAssetTime = $existingAssetProjection->captured_at ?? $existingAssetProjection->received_at;
                    $sampleTime = $capturedAt ?? $receivedAt;

                    if ($existingAssetTime === null || $sampleTime->greaterThanOrEqualTo($existingAssetTime)) {
                        $existingAssetProjection->update(['operational_asset_id' => null]);
                    } else {
                        // Incoming sample is older than the current asset projection; do not reassign asset
                        $sampleData['operational_asset_id'] = null;
                        $assetId = null;
                    }
                }
            }

            $existingProjection = LatestLocation::query()
                ->where('user_id', $userId)
                ->lockForUpdate()
                ->first();

            if ($existingProjection !== null) {
                $existingCapturedAt = $existingProjection->captured_at;
                $isNewer = $existingCapturedAt === null || $capturedAt->greaterThanOrEqualTo($existingCapturedAt);

                $canUpdateSharing = $isNewer;
                if (! $existingProjection->sharing_enabled && $sharingEnabled) {
                    $canUpdateSharing = $existingCapturedAt === null || $capturedAt->greaterThan($existingCapturedAt);
                }

                if ($isNewer) {
                    $effectiveSharing = $canUpdateSharing ? $sharingEnabled : false;
                    $existingProjection->update([
                        'operational_asset_id' => $assetId,
                        'dispatch_job_id' => $jobId,
                        'location_sample_id' => $sample->id,
                        'latitude' => $effectiveSharing ? $lat : null,
                        'longitude' => $effectiveSharing ? $lng : null,
                        'accuracy_metres' => $effectiveSharing ? $sample->accuracy_metres : null,
                        'speed' => $effectiveSharing ? $sample->speed : null,
                        'remarks' => $sample->remarks,
                        'source' => $sample->source,
                        'sharing_enabled' => $effectiveSharing,
                        'command_id' => $sample->command_id,
                        'captured_at' => $capturedAt,
                        'received_at' => $receivedAt,
                    ]);
                }

                $latestProjection = $existingProjection;
            } else {
                try {
                    $latestProjection = LatestLocation::query()->create([
                        'user_id' => $userId,
                        'operational_asset_id' => $assetId,
                        'dispatch_job_id' => $jobId,
                        'location_sample_id' => $sample->id,
                        'latitude' => $lat,
                        'longitude' => $lng,
                        'accuracy_metres' => $sharingEnabled ? $sample->accuracy_metres : null,
                        'speed' => $sharingEnabled ? $sample->speed : null,
                        'remarks' => $sample->remarks,
                        'source' => $sample->source,
                        'sharing_enabled' => $sharingEnabled,
                        'command_id' => $sample->command_id,
                        'captured_at' => $capturedAt,
                        'received_at' => $receivedAt,
                    ]);
                } catch (QueryException) {
                    $latestProjection = LatestLocation::query()
                        ->where('user_id', $userId)
                        ->lockForUpdate()
                        ->firstOrFail();
                }
            }

            $responsePayload = [
                'data' => $latestProjection->toDtoArray(),
            ];

            if (is_string($commandId) && $commandId !== '') {
                try {
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
                } catch (QueryException $e) {
                    $existing = TrackingCommandReceipt::query()->where('command_id', $commandId)->first();
                    if ($existing !== null) {
                        if ($existing->payload_hash !== null && ! hash_equals($existing->payload_hash, $payloadHash)) {
                            return [
                                'payload' => [
                                    'message' => 'This command ID was already used for a different command payload.',
                                    'error' => 'conflict',
                                ],
                                'status' => 409,
                            ];
                        }

                        if (is_array($existing->response_payload)) {
                            return [
                                'payload' => $existing->response_payload,
                                'status' => $existing->status_code,
                            ];
                        }
                    }

                    throw $e;
                }
            }

            return [
                'payload' => $responsePayload,
                'status' => 201,
            ];
        });

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

        $records = $query
            ->orderByDesc('received_at')
            ->orderByDesc('id')
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

        $samples = $query
            ->orderBy($orderBy, $orderDirection)
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
