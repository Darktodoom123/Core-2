<?php

namespace App\Modules\Assignment\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Actions\LinkUnit;
use App\Modules\Assignment\Actions\ReleaseUnit;
use App\Modules\Assignment\Http\Requests\Api\V1\LinkUnitRequest;
use App\Modules\Assignment\Http\Resources\V1\UnitLinkResource;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Models\OperationalAsset;
use App\Shared\Assets\Models\UnitLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** The unit the signed-in operator is bound to, so every phone agrees. */
final class UnitLinkController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        /** @var User $actor */
        $actor = $request->user();

        $link = UnitLink::query()->open()->where('user_id', $actor->id)->with('asset')->first();

        return response()->json([
            'data' => $link !== null ? new UnitLinkResource($link) : null,
        ]);
    }

    public function store(
        LinkUnitRequest $request,
        LinkUnit $action,
        IdempotentCommandService $idempotency,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        /** @var OperationalAsset $asset */
        $asset = OperationalAsset::query()->findOrFail((int) $request->validated('operational_asset_id'));
        $jobId = $request->validated('dispatch_job_id');

        $execute = function () use ($actor, $asset, $jobId, $action): JsonResponse {
            $result = $action->handle($actor, $asset, $jobId !== null ? (int) $jobId : null);

            return response()->json([
                'message' => "Linked to {$asset->code}.",
                'data' => new UnitLinkResource($result['link']->load('asset')),
            ], $result['created'] ? 201 : 200);
        };

        return $this->idempotent($request, $idempotency, $actor, 'unit_link.store', $execute);
    }

    public function release(
        Request $request,
        ReleaseUnit $action,
        IdempotentCommandService $idempotency,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        $execute = function () use ($actor, $action): JsonResponse {
            $link = $action->handle($actor);

            return response()->json([
                'message' => $link !== null ? "Released {$link->asset->code}." : 'No unit was linked.',
                'data' => $link !== null ? new UnitLinkResource($link) : null,
            ]);
        };

        return $this->idempotent($request, $idempotency, $actor, 'unit_link.release', $execute);
    }

    private function idempotent(
        Request $request,
        IdempotentCommandService $idempotency,
        User $actor,
        string $actionName,
        callable $execute,
    ): JsonResponse {
        $commandId = $idempotency->resolveCommandId($request, required: false);

        if ($commandId === null) {
            return $execute();
        }

        /** @var JsonResponse */
        return $idempotency->process(
            $actor,
            $commandId,
            $actionName,
            null,
            $execute,
            collect($request->all())->except('command_id')->all(),
            wrapInTransaction: false,
        );
    }
}
