<?php

namespace App\Platform\Audit\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Audit\Http\Requests\AuditEventIndexRequest;
use App\Platform\Audit\Queries\AuditEventQuery;
use App\Platform\Workspace\ViewModels\OperationsWorkspaceViewModel;
use Illuminate\Http\JsonResponse;

final class AuditEventIndexController extends Controller
{
    public function __invoke(AuditEventIndexRequest $request, AuditEventQuery $query): JsonResponse
    {
        $filters = $request->filters();
        $page = $query->paginate($filters);

        return response()->json([
            'events' => OperationsWorkspaceViewModel::auditEvents($page->getCollection()),
            'total' => $page->total(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'counts' => $query->counts($filters),
            'actors' => $query->actors(),
            'last_24h_total' => $query->countSince(now()->subDay()),
        ]);
    }
}
