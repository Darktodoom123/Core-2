<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Enums\PermissionName;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

final class ClientController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::DispatchViewAll->value);

        return response()->json(['data' => Client::query()->orderBy('company_name')->paginate(50)]);
    }

    public function store(Request $request, RecordAuditEvent $audit): JsonResponse
    {
        Gate::authorize(PermissionName::DispatchCreate->value);
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:32', 'unique:clients,code'],
            'company_name' => ['required', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:2000'],
        ]);
        $client = Client::query()->create([...$validated, 'status' => 'active']);
        $audit->handle($request->user(), $client, 'client.created', null, $client->toArray());

        return response()->json(['data' => $client], 201);
    }
}
