<?php

namespace App\Platform\Safety\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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

final class SafetyGovernanceApiController extends Controller
{
    public function storeToolboxMeeting(Request $request, SubmitToolboxMeeting $action): JsonResponse
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

        $meeting = $action->handle($request->user(), $validated);

        return response()->json(['data' => $meeting], 201);
    }

    public function coSignToolboxMeeting(Request $request, ToolboxMeeting $meeting, CoSignToolboxMeeting $action): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyTbmCoSign->value), 403);

        $updated = $action->handle($request->user(), $meeting);

        return response()->json(['data' => $updated]);
    }

    public function storeCriticalLiftPlan(Request $request, CreateCriticalLiftPlan $action): JsonResponse
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

        $plan = $action->handle($request->user(), $validated);

        return response()->json(['data' => $plan], 201);
    }

    public function authorizeCriticalLiftPlan(Request $request, CriticalLiftPlan $plan, AuthorizeCriticalLiftPlan $action): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyLiftPlanApprove->value), 403);

        $decision = $request->input('decision', 'approve');
        if ($decision === 'reject') {
            $validated = $request->validate(['reason' => ['required', 'string', 'min:3']]);
            $updated = $action->reject($request->user(), $plan, $validated['reason']);
        } else {
            $updated = $action->authorize($request->user(), $plan);
        }

        return response()->json(['data' => $updated]);
    }

    public function storeHazardTicket(Request $request, LogSiteHazardTicket $action): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyHazardReport->value), 403);

        $validated = $request->validate([
            'project_site' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:64'],
            'severity' => ['required', 'string', 'in:minor,moderate,high,imminent_danger'],
            'description' => ['required', 'string'],
            'location_detail' => ['required', 'string', 'max:255'],
            'photo_evidence_url' => ['nullable', 'string'],
            'corrective_action_required' => ['required', 'string'],
            'work_stoppage_issued' => ['nullable', 'boolean'],
        ]);

        $ticket = $action->handle($request->user(), $validated);

        return response()->json(['data' => $ticket], 201);
    }

    public function rectifyHazardTicket(Request $request, SiteHazardTicket $ticket, LogSiteHazardTicket $action): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyHazardRectify->value), 403);

        $updated = $action->rectify($request->user(), $ticket);

        return response()->json(['data' => $updated]);
    }

    public function storeWorkStoppage(Request $request, IssueWorkStoppageNotice $action): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyWorkStoppageIssue->value), 403);

        $validated = $request->validate([
            'project_site' => ['required', 'string', 'max:255'],
            'dole_regulation_reference' => ['nullable', 'string', 'max:128'],
            'reason' => ['required', 'string'],
            'affected_asset_ids' => ['nullable', 'array'],
            'affected_asset_ids.*' => ['integer'],
            'affected_area' => ['required', 'string', 'max:255'],
        ]);

        $notice = $action->handle($request->user(), $validated);

        return response()->json(['data' => $notice], 201);
    }

    public function liftWorkStoppage(Request $request, WorkStoppageNotice $notice, LiftWorkStoppageNotice $action): JsonResponse
    {
        abort_unless($request->user()->can(PermissionName::SafetyWorkStoppageLift->value), 403);

        $validated = $request->validate([
            'lift_reason' => ['required', 'string', 'min:5'],
        ]);

        $updated = $action->handle($request->user(), $notice, $validated['lift_reason']);

        return response()->json(['data' => $updated]);
    }

    public function indexHazards(Request $request): JsonResponse
    {
        $hazards = SiteHazardTicket::query()
            ->with(['reporter'])
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $hazards]);
    }

    public function indexToolboxMeetings(Request $request): JsonResponse
    {
        $meetings = ToolboxMeeting::query()
            ->with(['conductor', 'safetyOfficer'])
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $meetings]);
    }

    public function indexWorkStoppages(Request $request): JsonResponse
    {
        $notices = WorkStoppageNotice::query()
            ->with(['safetyOfficer', 'acknowledgedByUser', 'liftedByUser'])
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $notices]);
    }

    public function indexCriticalLiftPlans(Request $request): JsonResponse
    {
        $plans = CriticalLiftPlan::query()
            ->with(['craneOperator', 'leadRigger', 'safetyOfficer'])
            ->latest()
            ->limit(50)
            ->get();

        return response()->json(['data' => $plans]);
    }

    public function metrics(): JsonResponse
    {
        $openHazards = SiteHazardTicket::query()->where('status', 'open')->count();
        $activeWso = WorkStoppageNotice::query()->where('is_active', true)->count();
        $pendingLifts = CriticalLiftPlan::query()->where('status', 'pending_so_review')->count();
        $tbmCountToday = ToolboxMeeting::query()->whereDate('created_at', today())->count();

        // Baseline project hours + cumulative TBM man-hours (approx 8 hrs per attendee)
        $cumulativeTbmAttendees = (int) ToolboxMeeting::query()->sum('attendee_count');
        $dynamicSafeManHours = 140000 + ($cumulativeTbmAttendees * 8);

        // Days since latest active work stoppage
        $lastActiveStoppage = WorkStoppageNotice::query()->where('is_active', true)->latest('created_at')->first();
        $daysWithoutLti = $lastActiveStoppage ? 0 : 384;

        return response()->json([
            'data' => [
                'safe_man_hours_without_lti' => $dynamicSafeManHours,
                'days_without_lti' => $daysWithoutLti,
                'open_hazards' => $openHazards,
                'active_work_stoppages' => $activeWso,
                'pending_critical_lifts' => $pendingLifts,
                'toolbox_meetings_today' => $tbmCountToday,
            ],
        ]);
    }
}
