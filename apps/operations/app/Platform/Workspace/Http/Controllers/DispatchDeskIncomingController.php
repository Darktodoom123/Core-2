<?php

namespace App\Platform\Workspace\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Workspace\Http\Requests\DispatchDeskIncomingRequest;
use App\Platform\Workspace\Queries\DispatchDeskIncomingQuery;
use Illuminate\Http\JsonResponse;

final class DispatchDeskIncomingController extends Controller
{
    public function __invoke(DispatchDeskIncomingRequest $request, DispatchDeskIncomingQuery $query): JsonResponse
    {
        $filters = $request->filters();

        return response()->json($query->paginate(
            $request->user(),
            $filters['page'],
            $filters['focus_service_request_id'],
        ));
    }
}
