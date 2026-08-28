<?php

namespace App\Platform\Safety\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Safety\Actions\CancelSosIncident;
use App\Platform\Safety\Actions\ClassifySosIncident;
use App\Platform\Safety\Actions\TriggerSosIncident;
use App\Platform\Safety\Actions\UpdateSosIncidentLocation;
use App\Platform\Safety\Enums\SosIncidentCategory;
use App\Platform\Safety\Http\Requests\CancelSosIncidentRequest;
use App\Platform\Safety\Http\Requests\ClassifySosIncidentRequest;
use App\Platform\Safety\Http\Requests\TriggerSosIncidentRequest;
use App\Platform\Safety\Http\Requests\UpdateSosIncidentLocationRequest;
use App\Platform\Safety\Http\Resources\SosIncidentResource;
use App\Platform\Safety\Models\SosIncident;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class SosIncidentController extends Controller
{
    public function store(TriggerSosIncidentRequest $request, TriggerSosIncident $action): JsonResponse
    {
        if (! (bool) config('sos.enabled')) {
            return response()->json(['message' => 'Emergency SOS is currently disabled.', 'error' => 'sos_disabled'], 503);
        }

        $result = $action->handle($request->user(), $request->validated(), (string) $request->validated('command_id'));
        $incident = $result->incident->load(['dispatchJob', 'operationalAsset', 'acknowledgedBy']);

        return response()->json([
            'data' => new SosIncidentResource($incident),
            'reused' => ! $result->created,
            'reused_active_incident' => $result->reusedActiveIncident,
        ], $result->created ? 201 : 200);
    }

    public function active(Request $request): JsonResponse
    {
        $incident = SosIncident::query()->unresolved()
            ->where('reporter_id', $request->user()->id)
            ->with(['dispatchJob', 'operationalAsset', 'acknowledgedBy'])
            ->latest('received_at')
            ->first();

        return response()->json(['data' => $incident === null ? null : new SosIncidentResource($incident)]);
    }

    public function classify(ClassifySosIncidentRequest $request, SosIncident $sosIncident, ClassifySosIncident $action): JsonResponse
    {
        $updated = $action->handle(
            $request->user(),
            $sosIncident,
            SosIncidentCategory::from((string) $request->validated('category')),
            $request->validated('operational_asset_id'),
        )->load(['dispatchJob', 'operationalAsset', 'acknowledgedBy']);

        return response()->json(['data' => new SosIncidentResource($updated)]);
    }

    public function location(UpdateSosIncidentLocationRequest $request, SosIncident $sosIncident, UpdateSosIncidentLocation $action): JsonResponse
    {
        $updated = $action->handle(
            $request->user(),
            $sosIncident,
            (float) $request->validated('latitude'),
            (float) $request->validated('longitude'),
            $request->validated('accuracy_metres') === null ? null : (float) $request->validated('accuracy_metres'),
        )->load(['dispatchJob', 'operationalAsset', 'acknowledgedBy']);

        return response()->json(['data' => new SosIncidentResource($updated)]);
    }

    public function cancel(CancelSosIncidentRequest $request, SosIncident $sosIncident, CancelSosIncident $action): JsonResponse
    {
        $updated = $action->handle($request->user(), $sosIncident, (string) $request->validated('cancellation_reason'))
            ->load(['dispatchJob', 'operationalAsset', 'acknowledgedBy']);

        return response()->json(['data' => new SosIncidentResource($updated)]);
    }

    public function configuration(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->operationalRole() === RoleName::CraneOperator
                && $request->user()->can(PermissionName::SosTrigger->value),
            403,
        );

        $actions = [];
        if (filled(config('sos.local_emergency_number'))
            && filled(config('sos.local_emergency_label'))
            && preg_match('/^(?:\+[1-9]\d{7,14}|\d{3,6})$/', (string) config('sos.local_emergency_number')) === 1) {
            $number = (string) config('sos.local_emergency_number');
            $label = (string) config('sos.local_emergency_label');
            $actions[] = [
                'kind' => 'call',
                'label' => "Call {$label}",
                'number' => $number,
                'uri' => "tel:{$number}",
                'tel_uri' => "tel:{$number}",
                'hint' => 'Opens the phone app; review the number before placing the call.',
            ];
            $actions[] = [
                'kind' => 'sms',
                'label' => "Text {$label}",
                'number' => $number,
                'uri' => "sms:{$number}",
                'hint' => 'Opens messaging; review the recipient before sending.',
            ];
        }

        return response()->json(['data' => [
            'enabled' => (bool) config('sos.enabled'),
            'mobile_freshness_seconds' => (int) config('sos.mobile_freshness_seconds'),
            'automatic_retry_window_minutes' => (int) ceil(((int) config('sos.mobile_freshness_seconds')) / 60),
            'local_emergency_actions' => $actions,
            'actions' => $actions,
            'automatic_public_authority_contact' => false,
        ]]);
    }
}
