<?php

namespace App\Http\Controllers;

use App\Actions\RecordAuditEvent;
use App\Enums\PermissionName;
use App\Http\Requests\StoreClientRequest;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Gate;

final class ClientController extends Controller
{
    public function index(): JsonResponse
    {
        Gate::authorize(PermissionName::DispatchViewAll->value);

        return response()->json(['data' => Client::query()->orderBy('company_name')->paginate(50)]);
    }

    public function store(StoreClientRequest $request, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $client = Client::query()->create([...$request->validated(), 'status' => 'active']);
        $audit->handle($request->user(), $client, 'client.created', null, $client->toArray());

        if ($request->expectsJson()) {
            return response()->json(['data' => $client], 201);
        }

        return to_route('home')->with('flash', [
            'tone' => 'success',
            'message' => "Client {$client->company_name} was created.",
        ]);
    }
}
