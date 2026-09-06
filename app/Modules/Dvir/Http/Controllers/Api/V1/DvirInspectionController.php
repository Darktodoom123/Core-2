<?php

namespace App\Modules\Dvir\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Dvir\Actions\CreateDvirInspectionAction;
use App\Modules\Dvir\Http\Requests\Api\V1\CreateDvirInspectionRequest;
use App\Modules\Dvir\Http\Resources\V1\DvirInspectionResource;
use App\Modules\Dvir\Models\DvirInspection;
use App\Platform\Identity\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DvirInspectionController extends Controller
{
    /**
     * History of the authenticated operator's DVIR records, newest first.
     */
    public function index(Request $request): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $days = max(1, min((int) $request->query('days', '30'), 365));

        $inspections = DvirInspection::query()
            ->with(['checks', 'photos'])
            ->forUser($user->id)
            ->completedWithinDays($days)
            ->when($request->filled('operational_asset_id'), function ($query) use ($request): void {
                $query->where('operational_asset_id', (int) $request->query('operational_asset_id'));
            })
            ->orderBy('completed_at', 'desc')
            ->get();

        return response()->json([
            'data' => [
                'days' => $days,
                'inspections' => DvirInspectionResource::collection($inspections),
            ],
        ]);
    }

    public function store(CreateDvirInspectionRequest $request, CreateDvirInspectionAction $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $result = $action->execute($request, $user);

        return response()->json([
            'message' => 'DVIR inspection recorded successfully.',
            'data' => new DvirInspectionResource($result['inspection']),
        ], 201);
    }

    public function show(Request $request, int $inspection): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();

        $record = DvirInspection::query()
            ->with(['checks', 'photos'])
            ->forUser($user->id)
            ->find($inspection);

        if ($record === null) {
            return response()->json(['message' => 'DVIR inspection not found.'], 404);
        }

        return response()->json([
            'data' => new DvirInspectionResource($record),
        ]);
    }
}
