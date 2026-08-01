<?php

namespace App\Shared\Assets\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Http\Resources\V1\OperationalAssetResource;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

abstract class AssetCatalogController extends Controller
{
    /**
     * @return list<string>
     */
    abstract protected function assetKinds(): array;

    abstract protected function viewAllPermission(): PermissionName;

    abstract protected function viewAssignedPermission(): PermissionName;

    public function index(Request $request): JsonResponse
    {
        $assets = $this->visibleAssets($request->user())
            ->orderBy('code')
            ->paginate(50);

        return OperationalAssetResource::collection($assets)->response();
    }

    public function show(Request $request, OperationalAsset $operationalAsset): JsonResponse
    {
        abort_unless(
            in_array($operationalAsset->kind, $this->assetKinds(), true)
                && $this->visibleAssets($request->user())->whereKey($operationalAsset)->exists(),
            404,
        );

        return response()->json(['data' => new OperationalAssetResource($operationalAsset)]);
    }

    /**
     * @return Builder<OperationalAsset>
     */
    private function visibleAssets(User $user): Builder
    {
        abort_unless(
            $user->can($this->viewAllPermission()->value) || $user->can($this->viewAssignedPermission()->value),
            403,
        );

        $assets = OperationalAsset::query()->whereIn('kind', $this->assetKinds());

        if ($user->can($this->viewAllPermission()->value)) {
            return $assets;
        }

        return $assets->whereHas('assignments.job.personnelAssignments', fn (Builder $assignments): Builder => $assignments
            ->where('user_id', $user->id)
            ->whereNull('active_until'));
    }
}
