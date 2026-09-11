<?php

namespace App\Modules\Dispatch\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Enums\BusinessLine;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Dispatch\Http\Requests\StoreServiceRequest;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

final class ServiceRequestController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::DispatchViewAll->value);

        return response()->json(['data' => ServiceRequest::query()->with('client')->latest('scheduled_date')->paginate(50)]);
    }

    public function store(StoreServiceRequest $request, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $serviceRequest = ServiceRequest::query()->create([
            ...$request->validated(),
            'business_line' => $request->validated('business_line', BusinessLine::Service->value),
            'created_by' => $request->user()->id,
            'status' => ServiceRequestStatus::Submitted,
        ]);
        $audit->handle($request->user(), $serviceRequest, 'service_request.created', null, $serviceRequest->toArray());

        if ($request->expectsJson()) {
            return response()->json(['data' => $serviceRequest->load('client')], 201);
        }

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Service request {$serviceRequest->reference} was recorded.",
        ]);
    }
}
