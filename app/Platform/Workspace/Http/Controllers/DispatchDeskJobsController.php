<?php

namespace App\Platform\Workspace\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Workspace\Http\Requests\DispatchDeskJobsRequest;
use App\Platform\Workspace\Queries\DispatchDeskJobsQuery;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use Illuminate\Http\JsonResponse;

final class DispatchDeskJobsController extends Controller
{
    public function __invoke(DispatchDeskJobsRequest $request, DispatchDeskJobsQuery $query): JsonResponse
    {
        $page = $query->paginate($request->user(), $request->filters());

        return response()->json([
            'jobs' => OperationsWorkspaceViewModel::jobs($page->getCollection()),
            'total' => $page->total(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
        ]);
    }
}
