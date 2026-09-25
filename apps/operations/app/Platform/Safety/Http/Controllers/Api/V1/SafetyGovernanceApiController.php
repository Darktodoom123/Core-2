<?php

namespace App\Platform\Safety\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Safety\Actions\AuthorizeCriticalLiftPlan;
use App\Platform\Safety\Actions\CoSignToolboxMeeting;
use App\Platform\Safety\Actions\CreateCriticalLiftPlan;
use App\Platform\Safety\Actions\IssueWorkStoppageNotice;
use App\Platform\Safety\Actions\LiftWorkStoppageNotice;
use App\Platform\Safety\Actions\LogSiteHazardTicket;
use App\Platform\Safety\Actions\SubmitToolboxMeeting;
use App\Platform\Safety\Models\CriticalLiftPlan;
use App\Platform\Safety\Models\SiteHazardTicket;
use App\Platform\Safety\Models\ToolboxMeeting;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use LogicException;

final class SafetyGovernanceApiController extends Controller
{
    public function storeToolboxMeeting(Request $request, SubmitToolboxMeeting $action, IdempotentCommandService $idempotency): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyTbmSubmit->value), 403);

        $validated = $request->validate([
            'project_site' => ['required', 'string', 'max:255'],
            'topic_id' => ['required', 'string', 'max:64'],
            'topic_title' => ['required', 'string', 'max:255'],
            'topic_category' => ['required', 'string', 'max:64'],
            'attendee_ids' => ['required', 'array', 'min:1'],
            'attendee_ids.*' => ['string'],
            'photo_evidence_url' => ['nullable', 'string'],
            'notes' => ['nullable', 'string'],
        ]);

        return $this->idempotentJson($request, $idempotency, 'safety.toolbox_meeting.submit', fn (): JsonResponse => response()->json([
            'data' => $this->toolboxMeetingData($action->handle($request->user(), $validated)),
        ], 201));
    }

    public function coSignToolboxMeeting(Request $request, ToolboxMeeting $meeting, CoSignToolboxMeeting $action, IdempotentCommandService $idempotency): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyTbmCoSign->value), 403);

        return $this->idempotentJson($request, $idempotency, "safety.toolbox_meeting.cosign:{$meeting->id}", fn (): JsonResponse => response()->json([
            'data' => $this->toolboxMeetingData($action->handle($request->user(), $meeting)),
        ]));
    }

    public function storeCriticalLiftPlan(Request $request, CreateCriticalLiftPlan $action, IdempotentCommandService $idempotency): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyLiftPlanCreate->value), 403);

        $validated = $request->validate([
            'dispatch_job_id' => ['nullable', 'integer', 'exists:dispatch_jobs,id'],
            'operational_asset_id' => ['nullable', 'integer', 'exists:operational_assets,id'],
            'project_site' => ['required', 'string', 'max:255'],
            'crane_operator_id' => ['nullable', 'integer', 'exists:users,id'],
            'lead_rigger_id' => ['nullable', 'integer', 'exists:users,id'],
            'rigger_tesda_nc_number' => ['required', 'string', 'max:64'],
            'risk_level' => ['nullable', 'string', 'in:routine,standard_engineered,critical,complex_tandem'],
            'gross_load_weight_tons' => ['required_without:net_load_weight_tons', 'nullable', 'numeric', 'gt:0'],
            'net_load_weight_tons' => ['nullable', 'numeric', 'gt:0'],
            'rigging_weight_tons' => ['nullable', 'numeric', 'gte:0'],
            'hook_block_weight_tons' => ['nullable', 'numeric', 'gte:0'],
            'crane_rated_capacity_tons' => ['required', 'numeric', 'gt:0'],
            'boom_length_meters' => ['required', 'numeric', 'gt:0'],
            'working_radius_meters' => ['required', 'numeric', 'gt:0'],
            'ground_bearing_condition' => ['required', 'string', 'max:255'],
            'weather_wind_speed_kph' => ['nullable', 'numeric', 'gte:0'],
        ]);

        return $this->idempotentJson($request, $idempotency, 'safety.critical_lift_plan.create', fn (): JsonResponse => response()->json([
            'data' => $this->criticalLiftPlanData($action->handle($request->user(), $validated)),
        ], 201));
    }

    public function authorizeCriticalLiftPlan(Request $request, CriticalLiftPlan $plan, AuthorizeCriticalLiftPlan $action, IdempotentCommandService $idempotency): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyLiftPlanApprove->value), 403);

        $decision = $request->validate(['decision' => ['sometimes', 'string', 'in:approve,reject']])['decision'] ?? 'approve';
        if ($decision === 'reject') {
            $validated = $request->validate(['reason' => ['required', 'string', 'min:3', 'max:2000']]);

            return $this->idempotentJson($request, $idempotency, "safety.critical_lift_plan.reject:{$plan->id}", fn (): JsonResponse => response()->json([
                'data' => $this->criticalLiftPlanData($action->reject($request->user(), $plan, $validated['reason'])),
            ]));
        }

        return $this->idempotentJson($request, $idempotency, "safety.critical_lift_plan.approve:{$plan->id}", fn (): JsonResponse => response()->json([
            'data' => $this->criticalLiftPlanData($action->authorize($request->user(), $plan)),
        ]));
    }

    public function storeHazardTicket(Request $request, LogSiteHazardTicket $action, IdempotentCommandService $idempotency): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyHazardReport->value), 403);

        $validated = $request->validate([
            'project_site' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:64'],
            'severity' => ['required', 'string', 'in:low,medium,high,critical'],
            'description' => ['required', 'string', 'min:10', 'max:4000'],
            'location_detail' => ['required', 'string', 'max:255'],
            'corrective_action_required' => ['required', 'string', 'min:5', 'max:2000'],
            'location_latitude' => ['nullable', 'numeric', 'between:-90,90', 'required_with:location_longitude'],
            'location_longitude' => ['nullable', 'numeric', 'between:-180,180', 'required_with:location_latitude'],
            'location_accuracy_metres' => ['nullable', 'numeric', 'gte:0', 'max:100000'],
            'location_observed_at' => ['nullable', 'date'],
        ]);

        return $this->idempotentJson($request, $idempotency, 'safety.hazard_report.create', fn (): JsonResponse => response()->json([
            'data' => $this->hazardData($action->handle($request->user(), $validated)),
        ], 201));
    }

    public function rectifyHazardTicket(Request $request, SiteHazardTicket $ticket, LogSiteHazardTicket $action, IdempotentCommandService $idempotency): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyHazardRectify->value), 403);

        $validated = $request->validate([
            'rectification_notes' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        return $this->idempotentJson($request, $idempotency, "safety.hazard_report.rectify:{$ticket->id}", fn (): JsonResponse => response()->json([
            'data' => $this->hazardData($action->rectify($request->user(), $ticket, $validated['rectification_notes'])),
        ]));
    }

    public function storeWorkStoppage(Request $request, IssueWorkStoppageNotice $action, IdempotentCommandService $idempotency): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyWorkStoppageIssue->value), 403);

        $validated = $request->validate([
            'project_site' => ['required', 'string', 'max:255'],
            'dole_regulation_reference' => ['nullable', 'string', 'max:128'],
            'reason' => ['required', 'string', 'min:10', 'max:2000'],
            'affected_asset_ids' => ['nullable', 'array'],
            'affected_asset_ids.*' => ['integer', 'distinct', 'exists:operational_assets,id'],
            'affected_area' => ['required', 'string', 'max:255'],
        ]);

        return $this->idempotentJson($request, $idempotency, 'safety.work_stoppage.issue', fn (): JsonResponse => response()->json([
            'data' => $this->workStoppageData($action->handle($request->user(), $validated)),
        ], 201));
    }

    public function liftWorkStoppage(Request $request, WorkStoppageNotice $notice, LiftWorkStoppageNotice $action, IdempotentCommandService $idempotency): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyWorkStoppageLift->value), 403);

        $validated = $request->validate([
            'lift_reason' => ['required', 'string', 'min:5', 'max:2000'],
        ]);

        return $this->idempotentJson($request, $idempotency, "safety.work_stoppage.lift:{$notice->id}", fn (): JsonResponse => response()->json([
            'data' => $this->workStoppageData($action->handle($request->user(), $notice, $validated['lift_reason'])),
        ]));
    }

    public function indexHazards(Request $request): JsonResponse
    {
        $this->authorizeGovernanceView($request);

        $hazards = SiteHazardTicket::query()
            ->with([
                'reporter:id,name',
                'attachments:id,owner_id,owner_type,kind,original_filename,mime_type,size_bytes',
            ])
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $hazards->map(fn (SiteHazardTicket $hazard): array => $this->hazardData($hazard))->all()]);
    }

    public function indexToolboxMeetings(Request $request): JsonResponse
    {
        $this->authorizeGovernanceView($request);

        $meetings = ToolboxMeeting::query()
            ->with(['conductor:id,name', 'safetyOfficer:id,name'])
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $meetings->map(fn (ToolboxMeeting $meeting): array => $this->toolboxMeetingData($meeting))->all()]);
    }

    public function indexWorkStoppages(Request $request): JsonResponse
    {
        $this->authorizeGovernanceView($request);

        $notices = WorkStoppageNotice::query()
            ->with(['issuer:id,name', 'liftedByUser:id,name'])
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $notices->map(fn (WorkStoppageNotice $notice): array => $this->workStoppageData($notice))->all()]);
    }

    public function indexCriticalLiftPlans(Request $request): JsonResponse
    {
        $this->authorizeGovernanceView($request);

        $plans = CriticalLiftPlan::query()
            ->with(['craneOperator:id,name', 'leadRigger:id,name'])
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $plans->map(fn (CriticalLiftPlan $plan): array => $this->criticalLiftPlanData($plan))->all()]);
    }

    public function metrics(Request $request): JsonResponse
    {
        $this->authorizeGovernanceView($request);

        return response()->json(['data' => $this->metricsData()]);
    }

    public function overview(Request $request): JsonResponse
    {
        $this->authorizeGovernanceView($request);

        $hazards = SiteHazardTicket::query()
            ->with([
                'reporter:id,name',
                'attachments:id,owner_id,owner_type,kind,original_filename,mime_type,size_bytes',
            ])
            ->latest()
            ->limit(50)
            ->get();
        $plans = CriticalLiftPlan::query()
            ->with(['craneOperator:id,name', 'leadRigger:id,name'])
            ->latest()
            ->limit(50)
            ->get();
        $meetings = ToolboxMeeting::query()
            ->with(['conductor:id,name', 'safetyOfficer:id,name'])
            ->latest()
            ->limit(50)
            ->get();
        $notices = WorkStoppageNotice::query()
            ->with(['issuer:id,name', 'liftedByUser:id,name'])
            ->latest()
            ->limit(50)
            ->get();

        return response()->json([
            'data' => [
                'metrics' => $this->metricsData(),
                'hazards' => $hazards->map(fn (SiteHazardTicket $hazard): array => $this->hazardData($hazard))->all(),
                'liftPlans' => $plans->map(fn (CriticalLiftPlan $plan): array => $this->criticalLiftPlanData($plan))->all(),
                'toolboxMeetings' => $meetings->map(fn (ToolboxMeeting $meeting): array => $this->toolboxMeetingData($meeting))->all(),
                'workStoppages' => $notices->map(fn (WorkStoppageNotice $notice): array => $this->workStoppageData($notice))->all(),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function metricsData(): array
    {
        $openHazards = SiteHazardTicket::query()->where('status', 'open')->count();
        $activeWso = WorkStoppageNotice::query()->where('is_active', true)->count();
        $pendingLifts = CriticalLiftPlan::query()->where('status', 'pending_so_review')->count();
        $tbmCountToday = ToolboxMeeting::query()->whereDate('created_at', today())->count();

        return [
            'safe_man_hours_without_lti' => null,
            'days_without_lti' => null,
            'metric_availability' => [
                'safe_man_hours_without_lti' => 'unavailable',
                'days_without_lti' => 'unavailable',
            ],
            'open_hazards' => $openHazards,
            'active_work_stoppages' => $activeWso,
            'pending_critical_lifts' => $pendingLifts,
            'toolbox_meetings_today' => $tbmCountToday,
        ];
    }

    private function authorizeGovernanceView(Request $request): void
    {
        abort_unless($request->user()->can(PermissionName::SafetyGovernanceView->value), 403);
    }

    /** @param callable(): JsonResponse $execute */
    private function idempotentJson(Request $request, IdempotentCommandService $idempotency, string $actionName, callable $execute): JsonResponse
    {
        $commandId = $idempotency->resolveCommandId($request, required: true);
        $response = $idempotency->process(
            $request->user(),
            $commandId,
            $actionName,
            null,
            $execute,
            $request->except('command_id'),
        );

        if (! $response instanceof JsonResponse) {
            throw new LogicException('Safety commands must return a JSON response.');
        }

        return $response;
    }

    /** @return array<string, mixed> */
    private function hazardData(SiteHazardTicket $ticket): array
    {
        $ticket->loadMissing([
            'reporter:id,name',
            'attachments:id,owner_id,owner_type,kind,original_filename,mime_type,size_bytes',
        ]);

        return [
            'id' => $ticket->id,
            'ticket_code' => $ticket->ticket_code,
            'project_site' => $ticket->project_site,
            'category' => $ticket->category,
            'severity' => $ticket->severity,
            'description' => $ticket->description,
            'location_detail' => $ticket->location_detail,
            'corrective_action_required' => $ticket->corrective_action_required,
            'status' => $ticket->status,
            'work_stoppage_issued' => $ticket->work_stoppage_issued,
            'rectification_notes' => $ticket->rectification_notes,
            'location_latitude' => $ticket->location_latitude,
            'location_longitude' => $ticket->location_longitude,
            'location_accuracy_metres' => $ticket->location_accuracy_metres,
            'location_observed_at' => $ticket->location_observed_at?->toISOString(),
            'photo_attachments' => $ticket->attachments
                ->map(fn ($attachment): array => [
                    'id' => $attachment->id,
                    'original_filename' => $attachment->original_filename,
                    'mime_type' => $attachment->mime_type,
                    'size_bytes' => $attachment->size_bytes,
                    'download_url' => url("/operations/attachments/{$attachment->id}/download"),
                ])
                ->values()
                ->all(),
            'reporter_name' => $ticket->reporter->name,
            'created_at' => $ticket->created_at->toISOString(),
            'rectified_at' => $ticket->rectified_at?->toISOString(),
        ];
    }

    /** @return array<string, mixed> */
    private function criticalLiftPlanData(CriticalLiftPlan $plan): array
    {
        $plan->loadMissing(['craneOperator:id,name', 'leadRigger:id,name']);

        return [
            'id' => $plan->id,
            'lift_reference' => $plan->lift_reference,
            'project_site' => $plan->project_site,
            'risk_level' => $plan->risk_level,
            'gross_load_weight_tons' => $plan->gross_load_weight_tons,
            'crane_rated_capacity_tons' => $plan->crane_rated_capacity_tons,
            'load_percentage_of_capacity' => $plan->load_percentage_of_capacity,
            'boom_length_meters' => $plan->boom_length_meters,
            'working_radius_meters' => $plan->working_radius_meters,
            'ground_bearing_condition' => $plan->ground_bearing_condition,
            'weather_wind_speed_kph' => $plan->weather_wind_speed_kph,
            'status' => $plan->status,
            'rejection_reason' => $plan->rejection_reason,
            'operator_name' => $plan->craneOperator?->name,
            'rigger_name' => $plan->leadRigger?->name,
            'created_at' => $plan->created_at->toISOString(),
        ];
    }

    /** @return array<string, mixed> */
    private function toolboxMeetingData(ToolboxMeeting $meeting): array
    {
        $meeting->loadMissing(['conductor:id,name', 'safetyOfficer:id,name']);

        return [
            'id' => $meeting->id,
            'project_site' => $meeting->project_site,
            'topic_title' => $meeting->topic_title,
            'topic_category' => $meeting->topic_category,
            'conductor_name' => $meeting->conductor->name,
            'attendee_count' => $meeting->attendee_count,
            'notes' => $meeting->notes,
            'audit_hash' => $meeting->audit_hash,
            'safety_officer_name' => $meeting->safetyOfficer?->name,
            'safety_officer_signed_at' => $meeting->safety_officer_signed_at?->toISOString(),
            'created_at' => $meeting->created_at->toISOString(),
        ];
    }

    /** @return array<string, mixed> */
    private function workStoppageData(WorkStoppageNotice $notice): array
    {
        $notice->loadMissing(['issuer:id,name', 'liftedByUser:id,name']);

        return [
            'id' => $notice->id,
            'notice_number' => $notice->notice_number,
            'project_site' => $notice->project_site,
            'reason' => $notice->reason,
            'affected_area' => $notice->affected_area,
            'affected_asset_ids' => $notice->affected_asset_ids ?? [],
            'is_active' => $notice->is_active,
            'issuer_name' => $notice->issuer->name,
            'lifted_by_name' => $notice->liftedByUser?->name,
            'lifted_at' => $notice->lifted_at?->toISOString(),
            'lift_reason' => $notice->lift_reason,
            'created_at' => $notice->created_at->toISOString(),
        ];
    }
}
