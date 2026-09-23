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
        $filters = $request->filters();
        $page = $query->paginate($request->user(), $filters);
        $countFilters = [...$filters, 'attention' => false, 'needs_assignment' => false];

        return response()->json([
            'jobs' => OperationsWorkspaceViewModel::jobs($page->getCollection()),
            'total' => $page->total(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'attention_total' => $query->attentionCount($request->user(), $countFilters),
            'needs_assignment_total' => $query->needsAssignmentCount($request->user(), $countFilters),
        ]);
    }
}
