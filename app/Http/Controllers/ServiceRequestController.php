<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Enums\DispatchPriority;
use App\Enums\PermissionName;
use App\Models\ServiceRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;

final class ServiceRequestController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::DispatchViewAll->value);

        return response()->json(['data' => ServiceRequest::query()->with('client')->latest('scheduled_date')->paginate(50)]);
    }

    public function store(Request $request, RecordAuditEvent $audit): JsonResponse
    {
        Gate::authorize(PermissionName::DispatchCreate->value);
        $validated = $request->validate([
            'reference' => ['required', 'string', 'max:48', 'unique:service_requests,reference'],
            'client_id' => ['required', 'integer', 'exists:clients,id'],
            'project_name' => ['required', 'string', 'max:255'],
            'service_type' => ['required', 'string', 'max:64'],
            'location' => ['required', 'string', 'max:2000'],
            'site_notes' => ['nullable', 'string', 'max:5000'],
            'scheduled_date' => ['nullable', 'date'],
            'priority' => ['required', Rule::enum(DispatchPriority::class)],
            'requirements' => ['sometimes', 'array'],
            'requirements.*' => ['string', 'max:255'],
        ]);
        $serviceRequest = ServiceRequest::query()->create([...$validated, 'created_by' => $request->user()->id, 'status' => 'submitted']);
        $audit->handle($request->user(), $serviceRequest, 'service_request.created', null, $serviceRequest->toArray());

        return response()->json(['data' => $serviceRequest->load('client')], 201);
    }
}
