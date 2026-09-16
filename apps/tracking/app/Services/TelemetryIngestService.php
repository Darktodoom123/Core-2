<?php

namespace Tracking\Services;

use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Tracking\Models\LatestLocation;
use Tracking\Models\LocationSample;
use Tracking\Models\TrackingCommandReceipt;

final class TelemetryIngestService
{
    /**
     * Ingest a single location sample.
     *
     * @param  array<string, mixed>  $data
     * @return array{payload: array<string, mixed>, status: int}
     */
    public function ingest(array $data, ?string $commandId = null): array
    {
        $batch = [$data];
        if ($commandId !== null && $commandId !== '') {
            $batch[0]['command_id'] = $commandId;
        }

        $results = $this->ingestBatch($batch);

        return $results[0];
    }

    /**
     * Ingest a batch of location samples under ascending ID row locks on the primary database.
     *
     * @param  list<array<string, mixed>>  $batch
     * @return list<array{payload: array<string, mixed>, status: int, sample_id?: int, command_id?: ?string}>
     */
    public function ingestBatch(array $batch): array
    {
        if (empty($batch)) {
            return [];
        }

        $now = CarbonImmutable::now();
        $retentionCutoff = $now->subDays(30);

        // Pre-normalize samples and compute canonical hashes
        $normalizedSamples = [];
        $userIds = [];

        foreach ($batch as $index => $item) {
            $commandId = $item['command_id'] ?? null;
            $userId = (int) ($item['user_id'] ?? 0);
            $assetId = isset($item['operational_asset_id'])
                ? (int) $item['operational_asset_id']
                : null;
            $jobId = isset($item['dispatch_job_id'])
                ? (int) $item['dispatch_job_id']
                : null;
            $sharingEnabled = isset($item['sharing_enabled']) ? (bool) $item['sharing_enabled'] : true;

            $capturedAt = isset($item['captured_at'])
                ? CarbonImmutable::parse($item['captured_at'])
                : $now;
            $receivedAt = isset($item['received_at'])
                ? CarbonImmutable::parse($item['received_at'])
                : $now;

            // 30-day retention guardrail: immediately nullify coordinates for samples older than 30 days
            $isExpiredRetention = $capturedAt->lessThan($retentionCutoff);

            $rawLat = isset($item['latitude']) ? round((float) $item['latitude'], 7) : null;
            $rawLng = isset($item['longitude']) ? round((float) $item['longitude'], 7) : null;

            $lat = ($sharingEnabled && ! $isExpiredRetention) ? $rawLat : null;
            $lng = ($sharingEnabled && ! $isExpiredRetention) ? $rawLng : null;

            $accuracy = ($sharingEnabled && ! $isExpiredRetention && isset($item['accuracy_metres']))
                ? (float) $item['accuracy_metres']
                : null;
            $speed = ($sharingEnabled && ! $isExpiredRetention && isset($item['speed']))
                ? (float) $item['speed']
                : null;

            $remarks = isset($item['remarks']) ? (string) $item['remarks'] : null;
            if ($isExpiredRetention) {
                $remarks = trim(($remarks ? $remarks.' ' : '').'[COORDINATES_PURGED_RETENTION_EXPIRED]');
            }

            $canonicalPayload = [
                'user_id' => $userId,
                'operational_asset_id' => $assetId,
                'dispatch_job_id' => $jobId,
                'latitude' => $rawLat !== null ? round((float) $rawLat, 7) : null,
                'longitude' => $rawLng !== null ? round((float) $rawLng, 7) : null,
                'accuracy_metres' => isset($item['accuracy_metres']) ? round((float) $item['accuracy_metres'], 2) : null,
                'speed' => isset($item['speed']) ? round((float) $item['speed'], 2) : null,
                'remarks' => $remarks,
                'source' => (string) ($item['source'] ?? 'mobile'),
                'sharing_enabled' => $sharingEnabled,
                'captured_at' => isset($item['captured_at']) ? $capturedAt->toIso8601String() : null,
            ];
            ksort($canonicalPayload);
            $payloadHash = hash('sha256', json_encode($canonicalPayload, JSON_THROW_ON_ERROR));

            $normalizedSamples[$index] = [
                'user_id' => $userId,
                'operational_asset_id' => $assetId,
                'dispatch_job_id' => $jobId,
                'latitude' => $lat,
                'longitude' => $lng,
                'accuracy_metres' => $accuracy,
                'speed' => $speed,
                'remarks' => $remarks,
                'source' => (string) ($item['source'] ?? 'mobile'),
                'sharing_enabled' => $sharingEnabled,
                'command_id' => is_string($commandId) && $commandId !== '' ? $commandId : null,
                'captured_at' => $capturedAt,
                'received_at' => $receivedAt,
                'payload_hash' => $payloadHash,
                'is_expired_retention' => $isExpiredRetention,
            ];

            if ($userId > 0) {
                $userIds[$userId] = true;
            }

            if ($assetId !== null) {
                $holderId = LatestLocation::onWriteConnection()
                    ->where('operational_asset_id', $assetId)
                    ->where('user_id', '!=', $userId)
                    ->value('user_id');
                if ($holderId !== null && (int) $holderId > 0) {
                    $userIds[(int) $holderId] = true;
                }
            }
        }

        // Ascending sort of user IDs to avoid row-level lock deadlocks across concurrent batches
        $sortedUserIds = array_keys($userIds);
        sort($sortedUserIds, SORT_NUMERIC);

        /** @var list<array{payload: array<string, mixed>, status: int, sample_id?: int, command_id?: ?string}> */
        return DB::transaction(function () use ($normalizedSamples, $sortedUserIds): array {
            // Pessimistic row locking in ascending user ID order on the write connection
            if (! empty($sortedUserIds)) {
                LatestLocation::onWriteConnection()
                    ->whereIn('user_id', $sortedUserIds)
                    ->orderBy('user_id', 'asc')
                    ->lockForUpdate()
                    ->get();
            }

            $results = [];

            foreach ($normalizedSamples as $sample) {
                $commandId = $sample['command_id'];
                $payloadHash = $sample['payload_hash'];
                $userId = $sample['user_id'];
                $assetId = $sample['operational_asset_id'];
                $jobId = $sample['dispatch_job_id'];
                $sharingEnabled = $sample['sharing_enabled'];
                $lat = $sample['latitude'];
                $lng = $sample['longitude'];
                $capturedAt = $sample['captured_at'];
                $receivedAt = $sample['received_at'];

                // Strict idempotency check on primary database
                if ($commandId !== null) {
                    $receipt = TrackingCommandReceipt::onWriteConnection()
                        ->where('command_id', $commandId)
                        ->first();

                    if ($receipt !== null) {
                        if ($receipt->payload_hash !== null && ! hash_equals($receipt->payload_hash, $payloadHash)) {
                            $results[] = [
                                'payload' => [
                                    'message' => 'This command ID was already used for a different command payload.',
                                    'error' => 'conflict',
                                ],
                                'status' => 409,
                                'command_id' => $commandId,
                            ];

                            continue;
                        }

                        if (is_array($receipt->response_payload)) {
                            $results[] = [
                                'payload' => $receipt->response_payload,
                                'status' => $receipt->status_code,
                                'sample_id' => $receipt->location_sample_id,
                                'command_id' => $commandId,
                            ];

                            continue;
                        }
                    }
                }

                // Ensure an asset is only claimed by a single user at any given time,
                // but do not reassign if an out-of-order sample is older than the current asset holder's position.
                $effectiveAssetId = $assetId;
                if ($assetId !== null) {
                    $existingAssetHolder = LatestLocation::onWriteConnection()
                        ->where('operational_asset_id', $assetId)
                        ->where('user_id', '!=', $userId)
                        ->first();

                    if ($existingAssetHolder !== null) {
                        $holderTime = $existingAssetHolder->captured_at ?? $existingAssetHolder->received_at;
                        if ($holderTime !== null && $holderTime->greaterThan($capturedAt)) {
                            $effectiveAssetId = null;
                        } else {
                            $existingAssetHolder->update(['operational_asset_id' => null]);
                        }
                    }
                }

                $sampleRecord = LocationSample::onWriteConnection()->create([
                    'user_id' => $userId,
                    'operational_asset_id' => $effectiveAssetId,
                    'dispatch_job_id' => $jobId,
                    'latitude' => $lat,
                    'longitude' => $lng,
                    'accuracy_metres' => $sample['accuracy_metres'],
                    'speed' => $sample['speed'],
                    'remarks' => $sample['remarks'],
                    'source' => $sample['source'],
                    'sharing_enabled' => $sharingEnabled,
                    'command_id' => $commandId,
                    'captured_at' => $capturedAt,
                    'received_at' => $receivedAt,
                ]);

                $existingProjection = LatestLocation::onWriteConnection()
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
                            'operational_asset_id' => $effectiveAssetId,
                            'dispatch_job_id' => $jobId,
                            'location_sample_id' => $sampleRecord->id,
                            'latitude' => $effectiveSharing ? $lat : null,
                            'longitude' => $effectiveSharing ? $lng : null,
                            'accuracy_metres' => $effectiveSharing ? $sampleRecord->accuracy_metres : null,
                            'speed' => $effectiveSharing ? $sampleRecord->speed : null,
                            'remarks' => $sampleRecord->remarks,
                            'source' => $sampleRecord->source,
                            'sharing_enabled' => $effectiveSharing,
                            'command_id' => $sampleRecord->command_id,
                            'captured_at' => $capturedAt,
                            'received_at' => $receivedAt,
                        ]);
                    }

                    $latestProjection = $existingProjection;
                } else {
                    try {
                        $latestProjection = LatestLocation::onWriteConnection()->create([
                            'user_id' => $userId,
                            'operational_asset_id' => $effectiveAssetId,
                            'dispatch_job_id' => $jobId,
                            'location_sample_id' => $sampleRecord->id,
                            'latitude' => $lat,
                            'longitude' => $lng,
                            'accuracy_metres' => $sharingEnabled ? $sampleRecord->accuracy_metres : null,
                            'speed' => $sharingEnabled ? $sampleRecord->speed : null,
                            'remarks' => $sampleRecord->remarks,
                            'source' => $sampleRecord->source,
                            'sharing_enabled' => $sharingEnabled,
                            'command_id' => $sampleRecord->command_id,
                            'captured_at' => $capturedAt,
                            'received_at' => $receivedAt,
                        ]);
                    } catch (QueryException) {
                        $latestProjection = LatestLocation::onWriteConnection()
                            ->where('user_id', $userId)
                            ->lockForUpdate()
                            ->firstOrFail();
                    }
                }

                $responsePayload = [
                    'data' => $latestProjection->toDtoArray(),
                ];

                if ($commandId !== null) {
                    try {
                        TrackingCommandReceipt::onWriteConnection()->create([
                            'command_id' => $commandId,
                            'action' => 'telemetry.ingest',
                            'payload_hash' => $payloadHash,
                            'user_id' => $userId,
                            'location_sample_id' => $sampleRecord->id,
                            'status_code' => 201,
                            'response_payload' => $responsePayload,
                            'received_at' => $receivedAt,
                        ]);
                    } catch (QueryException $e) {
                        $existing = TrackingCommandReceipt::onWriteConnection()
                            ->where('command_id', $commandId)
                            ->first();

                        if ($existing !== null) {
                            if ($existing->payload_hash !== null && ! hash_equals($existing->payload_hash, $payloadHash)) {
                                $results[] = [
                                    'payload' => [
                                        'message' => 'This command ID was already used for a different command payload.',
                                        'error' => 'conflict',
                                    ],
                                    'status' => 409,
                                    'command_id' => $commandId,
                                ];

                                continue;
                            }

                            if (is_array($existing->response_payload)) {
                                $results[] = [
                                    'payload' => $existing->response_payload,
                                    'status' => $existing->status_code,
                                    'sample_id' => $existing->location_sample_id,
                                    'command_id' => $commandId,
                                ];

                                continue;
                            }
                        }

                        throw $e;
                    }
                }

                $results[] = [
                    'payload' => $responsePayload,
                    'status' => 201,
                    'sample_id' => $sampleRecord->id,
                    'command_id' => $commandId,
                ];
            }

            return $results;
        });
    }
}
