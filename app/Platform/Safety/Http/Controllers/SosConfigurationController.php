<?php

namespace App\Platform\Safety\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Safety\Actions\UpsertSosEmergencyContact;
use App\Platform\Safety\Http\Requests\StoreSosEmergencyContactRequest;
use App\Platform\Safety\Models\SosEmergencyContact;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

final class SosConfigurationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('configure', SosEmergencyContact::class);

        return response()->json(['data' => SosEmergencyContact::query()->active()->get()->map(fn (SosEmergencyContact $contact): array => [
            'id' => $contact->id,
            'name' => $contact->name,
            'role_label' => $contact->role_label,
            'escalation_order' => $contact->escalation_order,
            'is_active' => $contact->is_active,
        ])]);
    }

    public function store(StoreSosEmergencyContactRequest $request, UpsertSosEmergencyContact $action): JsonResponse
    {
        Gate::authorize('configure', SosEmergencyContact::class);
        /** @var array{name: string, role_label: string, phone_e164: string, escalation_order: int, is_active: bool} $data */
        $data = [
            ...$request->validated(),
            'is_active' => $request->boolean('is_active', true),
        ];
        $contact = $action->handle($data);

        return response()->json(['data' => ['id' => $contact->id, 'name' => $contact->name]], 201);
    }

    public function update(StoreSosEmergencyContactRequest $request, SosEmergencyContact $sosEmergencyContact, UpsertSosEmergencyContact $action): JsonResponse
    {
        Gate::authorize('configure', SosEmergencyContact::class);
        /** @var array{name: string, role_label: string, phone_e164: string, escalation_order: int, is_active: bool} $data */
        $data = [
            ...$request->validated(),
            'is_active' => $request->boolean('is_active', $sosEmergencyContact->is_active),
        ];
        $contact = $action->handle($data, $sosEmergencyContact);

        return response()->json(['data' => ['id' => $contact->id, 'name' => $contact->name]]);
    }

    public function deactivate(Request $request, SosEmergencyContact $sosEmergencyContact): JsonResponse
    {
        Gate::authorize('configure', SosEmergencyContact::class);
        $sosEmergencyContact->update(['is_active' => false]);

        return response()->json(['data' => ['id' => $sosEmergencyContact->id, 'is_active' => false]]);
    }
}
