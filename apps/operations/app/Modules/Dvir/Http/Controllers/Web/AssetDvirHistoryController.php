<?php

namespace App\Modules\Dvir\Http\Controllers\Web;

use App\Http\Controllers\Controller;
use App\Modules\Dvir\Models\DvirInspection;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class AssetDvirHistoryController extends Controller
{
    public function index(Request $request, OperationalAsset $operationalAsset): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        abort_unless(
            OperationalAsset::query()
                ->whereKey($operationalAsset->getKey())
                ->visibleTo($user)
                ->exists(),
            404,
        );

        $limit = min(max($request->integer('limit', 15), 1), 25);
        $filter = (string) $request->query('filter', 'all');
        abort_unless(in_array($filter, ['all', 'needs_attention', 'pre_trip', 'post_trip'], true), 422);

        $baseQuery = $operationalAsset->dvirInspections()
            ->with(['photos', 'checks'])
            ->whereNotNull('completed_at')
            ->when($filter === 'needs_attention', function (Builder $query): void {
                $query->where(function (Builder $query): void {
                    $query->where('has_defects', true)
                        ->orWhere('critical_defects_count', '>', 0);
                });
            })
            ->when(in_array($filter, ['pre_trip', 'post_trip'], true), function (Builder $query) use ($filter): void {
                $query->where('inspection_type', $filter);
            })
            ->when($request->filled('days'), function (Builder $query) use ($request): void {
                $days = min(max($request->integer('days'), 1), 365);
                $query->where('completed_at', '>=', now()->subDays($days)->startOfDay());
            });

        $total = (clone $baseQuery)->count();
        $query = (clone $baseQuery)
            ->orderByDesc('completed_at')
            ->orderByDesc('id');

        $beforeId = $request->integer('before_id') ?: null;
        $beforeCompletedAt = $request->query('before_completed_at');
        if ($beforeId !== null && is_string($beforeCompletedAt) && $beforeCompletedAt !== '') {
            try {
                $before = CarbonImmutable::parse($beforeCompletedAt);
            } catch (\Throwable) {
                abort(422, 'The DVIR history cursor is invalid.');
            }

            $query->where(function (Builder $query) use ($before, $beforeId): void {
                $query->where('completed_at', '<', $before)
                    ->orWhere(function (Builder $query) use ($before, $beforeId): void {
                        $query->where('completed_at', $before)
                            ->where('id', '<', $beforeId);
                    });
            });
        }

        /** @var list<DvirInspection> $records */
        $records = $query->limit($limit + 1)->get()->all();
        $hasMore = count($records) > $limit;
        if ($hasMore) {
            $records = array_slice($records, 0, $limit);
        }

        $last = $records === [] ? null : $records[array_key_last($records)];

        return response()->json([
            'data' => array_map(fn (DvirInspection $inspection): array => $this->serialize($inspection), $records),
            'meta' => [
                'total' => $total,
                'has_more' => $hasMore,
                'next' => $hasMore && $last !== null ? [
                    'before_id' => (int) $last->getKey(),
                    'before_completed_at' => $last->completed_at?->toIso8601String(),
                ] : null,
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function serialize(DvirInspection $dvir): array
    {
        $criticalCount = (int) $dvir->critical_defects_count;
        $status = match (true) {
            $criticalCount > 0 => 'critical_defect',
            (bool) $dvir->has_defects => 'defect_flagged',
            default => 'passed',
        };

        return [
            'id' => (int) $dvir->id,
            'reference' => $dvir->reference,
            'inspection_type' => $dvir->inspection_type->value,
            'type' => $dvir->inspection_type->value,
            'status' => $status,
            'has_defects' => (bool) $dvir->has_defects,
            'critical_defects_count' => $criticalCount,
            'completed_at' => $dvir->completed_at?->toIso8601String(),
            'received_at' => $dvir->created_at?->toIso8601String(),
            'inspector_name' => $dvir->inspector_name,
            'starting_odometer_km' => $dvir->starting_odometer_km !== null ? (float) $dvir->starting_odometer_km : null,
            'ending_odometer_km' => $dvir->ending_odometer_km !== null ? (float) $dvir->ending_odometer_km : null,
            'engine_hours' => $dvir->engine_hours !== null ? (float) $dvir->engine_hours : null,
            'remarks' => $dvir->remarks,
            'signature_captured' => (bool) $dvir->signature_captured,
            'photos' => $dvir->photos->map(static fn ($photo): array => [
                'id' => (int) $photo->id,
                'angle' => $photo->angle,
                'url' => $photo->url,
                'file_name' => $photo->file_name ?? "{$photo->angle}.jpg",
                'is_defect_photo' => str_starts_with($photo->angle, 'defect') || (bool) ($photo->is_defect_photo ?? false),
            ])->values()->all(),
            'defects' => $dvir->checks
                ->filter(static fn ($check): bool => $check->status->isDefect())
                ->map(static fn ($check): array => [
                    'id' => (int) $check->id,
                    'category' => $check->category,
                    'label' => $check->label,
                    'status' => $check->status->value,
                    'notes' => $check->notes,
                ])->values()->all(),
        ];
    }
}
