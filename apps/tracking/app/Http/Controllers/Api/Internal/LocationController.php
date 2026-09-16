<?php

namespace Tracking\Http\Controllers\Api\Internal;

use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Tracking\Http\Requests\IngestLocationRequest;
use Tracking\Models\LatestLocation;
use Tracking\Models\LocationSample;
use Tracking\Services\TelemetryIngestService;

final class LocationController extends Controller
{
    public function __construct(
        private readonly TelemetryIngestService $ingestService,
    ) {}

    public function ingest(IngestLocationRequest $request): JsonResponse
    {
        $commandId = $request->input('command_id')
            ?? $request->header('X-Command-Id')
            ?? $request->header('Idempotency-Key');

        $result = $this->ingestService->ingest(
            $request->validated(),
            is_string($commandId) ? $commandId : null,
        );

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

        $limit = min(max((int) ($request->input('limit') ?? $request->input('per_page') ?? 500), 1), 1000);

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
