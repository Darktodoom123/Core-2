<?php

namespace Database\Seeders\Development;

use App\Modules\Assignment\Actions\AssignDispatchResources;
use App\Modules\Assignment\Actions\RespondToDispatchAssignment;
use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Dispatch\Actions\ActivateDispatchJob;
use App\Modules\Dispatch\Actions\ConvertServiceRequestToDispatch;
use App\Modules\Dispatch\Actions\DecideApprovalRequest;
use App\Modules\Dispatch\Actions\TransitionDispatchJob;
use App\Modules\Dispatch\Enums\ApprovalStatus;
use App\Modules\Dispatch\Enums\BusinessLine;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\ServiceRequestStatus;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Dvir\Enums\DvirInspectionType;
use App\Modules\Dvir\Models\DvirInspection;
use App\Modules\Fuel\Actions\SubmitMobileFuelRequest;
use App\Modules\Fuel\Actions\TransitionFuelRequest;
use App\Modules\Fuel\Enums\FuelRequestStatus;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\HoursOfService\Actions\CertifyAndCompleteShiftAction;
use App\Modules\HoursOfService\Actions\StartOperatorShiftAction;
use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Reporting\Actions\ReviewJobReport;
use App\Platform\Reporting\Actions\SubmitJobReport;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use LogicException;

/**
 * Opt-in, end-to-end demonstration scenario for the capstone defense. Never called by DatabaseSeeder.
 *
 * Seven Core 1 service requests are driven through the real domain actions, each one stopped at a
 * different stage so the whole lifecycle can be shown live: intake → convert → link assets →
 * approval → activation → field execution (DVIR, HoS, fuel) → job report → supervisory close-out.
 *
 *   php artisan db:seed --class="Database\Seeders\Development\DefenseDemoSeeder"
 */
final class DefenseDemoSeeder extends Seeder
{
    public const string MARKER_REFERENCE = 'SR-C1-2026-0101';

    private const string PASSWORD = 'password';

    private User $dispatcher;

    private User $approver;

    /** @var array<string, User> */
    private array $crew = [];

    /** @var array<string, OperationalAsset> */
    private array $cranes = [];

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new LogicException('Defense demo data may only be seeded in local or testing environments.');
        }

        if (ServiceRequest::withTrashed()->where('reference', self::MARKER_REFERENCE)->exists()) {
            $this->command?->warn('Defense demo already seeded. Run `php artisan migrate:fresh --seed` first to reset it.');

            return;
        }

        $this->call(RolePermissionSeeder::class);
        $anchor = Carbon::now()->startOfMinute();

        // Seeders run unguarded; the domain actions are written for guarded (HTTP) models.
        Model::reguard();

        try {
            DB::transaction(function () use ($anchor): void {
                $this->seedPeople();
                $this->seedCranes();

                // Ordered oldest-first so every step happens "in time" for the audit trail.
                $this->stage7ClosedOut($anchor);
                $this->stage6AwaitingReportReview($anchor);
                $this->stage5WorkingOnSite($anchor);
                $this->stage4AwaitingOperatorAcceptance($anchor);
                $this->stage3AwaitingManagerApproval($anchor);
                $this->stage2ConvertedNeedsAssets($anchor);
                $this->stage1FreshCore1Intake($anchor);
            });
        } finally {
            Carbon::setTestNow();
            Model::unguard();
        }

        $this->command?->info('Defense demo seeded. Log in as "dispatcher.linking" to present the dispatch desk.');
    }

    // ---------------------------------------------------------------------
    // Stages (newest at the bottom of the desk queue, oldest closed out)
    // ---------------------------------------------------------------------

    /** Stage 7 — the full reference run, completed and approved five days ago. */
    private function stage7ClosedOut(Carbon $anchor): void
    {
        $start = $anchor->copy()->subDays(5)->setTime(7, 0);
        $operator = $this->crew['operator.rsantos'];
        $rigger = $this->crew['rigger.mbautista'];
        $crane = $this->cranes['DEF-CRN-2501'];

        $this->at($start->copy()->subDays(3));
        $request = $this->intake('SR-C1-2026-0107', 'bayview', 'Precast façade panel erection – Tower B, L8 to L12', 'Bayview Towers, Roxas Blvd., Pasay City', $start, DispatchPriority::Routine, [14.5376, 120.9856]);

        $this->at($start->copy()->subDays(2));
        $job = $this->convert($request, 'DSP-2026-0107', $start, $start->copy()->addHours(9));
        $job = $this->link($job, $operator, $rigger, $crane);
        $job = app(ActivateDispatchJob::class)->handle($this->dispatcher, $job, $job->version);

        $this->at($start->copy()->subDay()->setTime(18, 20));
        $job = $this->accept($job, $operator);

        $this->at($start->copy()->subMinutes(40));
        $shift = app(StartOperatorShiftAction::class)->execute($operator, $crane->id, $job->id, DutyStatus::DRIVING);
        $this->preTrip($job, $operator, $crane, 'All 24 checklist items passed. Outriggers and wire rope OK.');
        $job = $this->move($job, $operator, DispatchStatus::EnRoute);

        $this->at($start->copy()->addMinutes(35));
        $job = $this->move($job, $operator, DispatchStatus::Arrived);

        $this->at($start->copy()->addHour());
        $job = $this->move($job, $operator, DispatchStatus::Working);

        $this->at($start->copy()->addHours(4));
        $fuel = $this->requestFuel($job, $operator, $crane, $shift->id, 120, 'Refuel before afternoon lifts; tank at 30%.', 30);
        $this->at($start->copy()->addHours(4)->addMinutes(10));
        $this->fuelStep($fuel, $this->dispatcher, FuelRequestStatus::Forwarded);
        $this->at($start->copy()->addHours(4)->addMinutes(20));
        $this->fuelStep($fuel, $this->approver, FuelRequestStatus::Approved, 'Within daily allocation.');
        $this->at($start->copy()->addHours(4)->addMinutes(50));
        $this->fuelStep($fuel, $this->dispatcher, FuelRequestStatus::Verified);
        $this->at($start->copy()->addHours(5));
        $this->fuelStep($fuel, $operator, FuelRequestStatus::Logged, null, [
            'quantity_litres' => 118,
            'hour_meter' => (float) $crane->meter_value + 5,
            'price_per_litre' => 61.35,
            'fuel_station' => 'On-site bowser – Bayview Towers',
            'no_receipt_reason' => 'on_site_bowser',
            'no_receipt_note' => 'Dispensed from client bowser; bowser slip #BT-2210.',
            'remarks' => 'Tank topped up to 95%.',
        ]);

        $end = $start->copy()->addHours(9);
        $this->at($end->copy()->subMinutes(10));
        $report = app(SubmitJobReport::class)->execute($operator, [
            'dispatch_job_id' => $job->id,
            'started_at' => $start->copy()->addHour()->toIso8601String(),
            'ended_at' => $end->copy()->subMinutes(15)->toIso8601String(),
            'ending_meter_value' => (float) $crane->meter_value + 9,
            'meter_type' => 'hour_meter',
            'latitude' => 14.5377,
            'longitude' => 120.9857,
            'work_summary' => 'Erected 16 precast façade panels (L8–L12, grid A–D). No incidents. 45-min standby waiting for panel delivery.',
            'remarks' => 'Client requested same crew for Tower C next month.',
            'signer_name' => 'Engr. Liza Manalo',
            'signer_role' => 'Site Project Engineer',
            'signed_at' => $end->copy()->subMinutes(12)->toIso8601String(),
        ]);

        $this->at($end->copy()->addMinutes(5));
        app(CertifyAndCompleteShiftAction::class)->execute($operator, 'I certify that my duty log for this shift is true and correct.', 'Shift closed after panel erection.', $crane->id, $job->id);

        $this->at($end->copy()->addHours(2));
        app(ReviewJobReport::class)->execute($this->approver, $report, 'approved', 'Signed off by client engineer; meters and fuel reconcile.');
    }

    /** Stage 6 — work finished this morning, job report waiting for the manager's review. */
    private function stage6AwaitingReportReview(Carbon $anchor): void
    {
        $start = $anchor->copy()->subHours(7);
        $operator = $this->crew['operator.jvillanueva'];
        $crane = $this->cranes['DEF-CRN-5002'];

        $this->at($start->copy()->subDays(2));
        $request = $this->intake('SR-C1-2026-0106', 'northgate', 'Rooftop chiller unit hoisting – Warehouse 3', 'Northgate Logistics Park, Marilao, Bulacan', $start, DispatchPriority::Routine, [14.7580, 120.9480]);

        $this->at($start->copy()->subDay());
        $job = $this->convert($request, 'DSP-2026-0106', $start, $start->copy()->addHours(6));
        $job = $this->link($job, $operator, $this->crew['rigger.egarcia'], $crane);
        $job = app(ActivateDispatchJob::class)->handle($this->dispatcher, $job, $job->version);
        $job = $this->accept($job, $operator);

        $this->at($start->copy()->subMinutes(30));
        $this->preTrip($job, $operator, $crane, 'Pre-trip OK. Load chart and anemometer verified.');
        $job = $this->move($job, $operator, DispatchStatus::EnRoute);
        $this->at($start->copy()->addMinutes(40));
        $job = $this->move($job, $operator, DispatchStatus::Arrived);
        $this->at($start->copy()->addHour());
        $job = $this->move($job, $operator, DispatchStatus::Working);

        $this->at($start->copy()->addHours(5)->addMinutes(40));
        app(SubmitJobReport::class)->execute($operator, [
            'dispatch_job_id' => $job->id,
            'started_at' => $start->copy()->addHour()->toIso8601String(),
            'ended_at' => $start->copy()->addHours(5)->addMinutes(30)->toIso8601String(),
            'ending_meter_value' => (float) $crane->meter_value + 6,
            'meter_type' => 'hour_meter',
            'latitude' => 14.7581,
            'longitude' => 120.9481,
            'work_summary' => 'Hoisted 2 × 4.2 t chiller units to the Warehouse 3 roof. Tag lines used; wind below 20 km/h throughout.',
            'signer_name' => 'Mr. Dante Robles',
            'signer_role' => 'Facilities Supervisor',
            'signed_at' => $start->copy()->addHours(5)->addMinutes(35)->toIso8601String(),
        ]);
    }

    /** Stage 5 — crew on site right now: shift running, pre-trip done, fuel request awaiting approval. */
    private function stage5WorkingOnSite(Carbon $anchor): void
    {
        $start = $anchor->copy()->subHours(3);
        $operator = $this->crew['operator.rsantos'];
        $crane = $this->cranes['DEF-CRN-3003'];

        $this->at($start->copy()->subDays(2));
        $request = $this->intake('SR-C1-2026-0105', 'sanroque', 'Pipe spool lifting – pumping station expansion', 'San Roque Pumping Station, Antipolo City', $start, DispatchPriority::Routine, [14.5860, 121.1760]);

        $this->at($start->copy()->subDay());
        $job = $this->convert($request, 'DSP-2026-0105', $start, $start->copy()->addHours(8));
        $job = $this->link($job, $operator, $this->crew['rigger.mbautista'], $crane);
        $job = app(ActivateDispatchJob::class)->handle($this->dispatcher, $job, $job->version);
        $job = $this->accept($job, $operator);

        $this->at($start->copy()->subMinutes(45));
        $shift = app(StartOperatorShiftAction::class)->execute($operator, $crane->id, $job->id, DutyStatus::DRIVING);
        $this->preTrip($job, $operator, $crane, 'Pre-trip OK. Minor tyre wear noted, within limits.');
        $job = $this->move($job, $operator, DispatchStatus::EnRoute);
        $this->at($start->copy()->addMinutes(20));
        $job = $this->move($job, $operator, DispatchStatus::Arrived);
        $this->at($start->copy()->addMinutes(45));
        $job = $this->move($job, $operator, DispatchStatus::Working);

        $this->at($anchor->copy()->subMinutes(25));
        $fuel = $this->requestFuel($job, $operator, $crane, $shift->id, 80, 'Low fuel after morning lifts; 4 more spools scheduled this afternoon.', 25);
        $this->at($anchor->copy()->subMinutes(15));
        $this->fuelStep($fuel, $this->dispatcher, FuelRequestStatus::Forwarded);
        Carbon::setTestNow();
    }

    /** Stage 4 — dispatched for tomorrow; the operator still has to accept it in the field app. */
    private function stage4AwaitingOperatorAcceptance(Carbon $anchor): void
    {
        $start = $anchor->copy()->addDay()->setTime(7, 0);

        $this->at($anchor->copy()->subHours(6));
        $request = $this->intake('SR-C1-2026-0104', 'mabini', 'Steel truss installation – fabrication shed', 'Mabini Steel Yard, Calamba, Laguna', $start, DispatchPriority::Routine, [14.2117, 121.1653]);

        $this->at($anchor->copy()->subHours(2));
        $job = $this->convert($request, 'DSP-2026-0104', $start, $start->copy()->addHours(8));
        $job = $this->link($job, $this->crew['operator.jvillanueva'], $this->crew['rigger.egarcia'], $this->cranes['DEF-CRN-2504']);
        app(ActivateDispatchJob::class)->handle($this->dispatcher, $job, $job->version);
        Carbon::setTestNow();
    }

    /** Stage 3 — priority job with crew and crane linked; the manager must approve before it can go out. */
    private function stage3AwaitingManagerApproval(Carbon $anchor): void
    {
        $start = $anchor->copy()->addDays(2)->setTime(6, 0);

        $this->at($anchor->copy()->subHours(5));
        $request = $this->intake('SR-C1-2026-0103', 'lagunasolar', 'Transformer placement – 12 MW solar substation', 'Laguna Solar Farm, Bay, Laguna', $start, DispatchPriority::Priority, [14.1800, 121.2830]);

        $this->at($anchor->copy()->subHour());
        $job = $this->convert($request, 'DSP-2026-0103', $start, $start->copy()->addHours(10));
        $this->link($job, $this->crew['operator.rsantos'], $this->crew['rigger.alim'], $this->cranes['DEF-CRN-8005']);
        Carbon::setTestNow();
    }

    /** Stage 2 — converted to a draft dispatch; the dispatcher links crane and crew live. */
    private function stage2ConvertedNeedsAssets(Carbon $anchor): void
    {
        $start = $anchor->copy()->addDays(3)->setTime(8, 0);

        $this->at($anchor->copy()->subHours(3));
        $request = $this->intake('SR-C1-2026-0102', 'pampanga', 'Cold-room panel and compressor lift', 'Pampanga Cold Storage, San Fernando, Pampanga', $start, DispatchPriority::Routine, [15.0286, 120.6898]);

        $this->at($anchor->copy()->subMinutes(30));
        $this->convert($request, 'DSP-2026-0102', $start, $start->copy()->addHours(6));
        Carbon::setTestNow();
    }

    /** Stage 1 — brand-new Core 1 request, not yet touched by operations. Convert it live. */
    private function stage1FreshCore1Intake(Carbon $anchor): void
    {
        $this->at($anchor->copy()->subMinutes(10));
        $this->intake(self::MARKER_REFERENCE, 'bayview', 'Tower crane mast delivery unloading – Tower C', 'Bayview Towers, Roxas Blvd., Pasay City', $anchor->copy()->addDays(4)->setTime(7, 0), DispatchPriority::Routine, [14.5376, 120.9856]);
        Carbon::setTestNow();
    }

    // ---------------------------------------------------------------------
    // Workflow steps (each goes through the same action the UI/API uses)
    // ---------------------------------------------------------------------

    /** @param array{float, float} $coordinates */
    private function intake(string $reference, string $clientKey, string $project, string $site, Carbon $scheduled, DispatchPriority $priority, array $coordinates): ServiceRequest
    {
        $client = $this->client($clientKey);

        return ServiceRequest::query()->create([
            'reference' => $reference,
            'client_id' => $client->id,
            'created_by' => $this->dispatcher->id,
            'business_line' => BusinessLine::Service,
            'project_name' => $project,
            'service_type' => 'crane_lift',
            'location' => $site,
            'site_notes' => sprintf('Site contact: %s (%s). GPS %.4f, %.4f. Gate pass required; PPE and toolbox talk before lift.', $client->contact_person, $client->phone, $coordinates[0], $coordinates[1]),
            'scheduled_date' => $scheduled,
            'priority' => $priority,
            'status' => ServiceRequestStatus::Submitted,
            'requirements' => ['Mobile crane with valid load test', 'TESDA-certified crane operator', 'Certified rigger / signalperson'],
        ]);
    }

    private function convert(ServiceRequest $request, string $reference, Carbon $start, Carbon $end): DispatchJob
    {
        $job = app(ConvertServiceRequestToDispatch::class)->handle($request->id, $this->dispatcher, [
            'reference' => $reference,
            'scheduled_start' => $start->toIso8601String(),
            'scheduled_end' => $end->toIso8601String(),
        ]);

        if (preg_match('/GPS ([\d.]+), ([\d.]+)/', (string) $request->site_notes, $gps) === 1) {
            $job->forceFill(['site_latitude' => (float) $gps[1], 'site_longitude' => (float) $gps[2]])->save();
        }

        return $job->refresh();
    }

    /** The key demo action: link the crane and its crew to the dispatch. */
    private function link(DispatchJob $job, User $operator, User $rigger, OperationalAsset $crane): DispatchJob
    {
        $job = app(AssignDispatchResources::class)->handle(
            $this->dispatcher,
            $job,
            [
                ['user_id' => $operator->id, 'assignment_type' => 'crane_operator'],
                ['user_id' => $rigger->id, 'assignment_type' => 'rigger'],
            ],
            [['operational_asset_id' => $crane->id, 'assignment_type' => 'crane']],
            $job->version,
        );

        if ($job->priority->requiresApproval()) {
            $approval = ApprovalRequest::query()
                ->where('subject_type', $job->getMorphClass())
                ->where('subject_id', $job->id)
                ->where('status', ApprovalStatus::Pending)
                ->latest('id')
                ->first();

            // Stage 3 intentionally stops here with the approval still pending.
            if ($approval !== null && $job->reference !== 'DSP-2026-0103') {
                app(DecideApprovalRequest::class)->handle($this->approver, $approval, ApprovalStatus::Approved, 'Crew credentials and crane readiness verified.');
            }
        }

        return $job->refresh();
    }

    private function accept(DispatchJob $job, User $operator): DispatchJob
    {
        $assignment = $job->personnelAssignments()->where('user_id', $operator->id)->whereNull('active_until')->firstOrFail();
        app(RespondToDispatchAssignment::class)->handle($operator, $job, $assignment, AssignmentResponse::Accepted, null, $job->refresh()->version);

        return $this->move($job->refresh(), $operator, DispatchStatus::Accepted);
    }

    private function move(DispatchJob $job, User $actor, DispatchStatus $next): DispatchJob
    {
        return app(TransitionDispatchJob::class)->handle($actor, $job, $next, $job->refresh()->version);
    }

    private function preTrip(DispatchJob $job, User $operator, OperationalAsset $crane, string $remarks): void
    {
        DvirInspection::query()->create([
            'user_id' => $operator->id,
            'operational_asset_id' => $crane->id,
            'dispatch_job_id' => $job->id,
            'inspection_type' => DvirInspectionType::PRE_TRIP,
            'asset_code' => $crane->code,
            'asset_name' => $crane->name,
            'inspector_name' => $operator->name,
            'engine_hours' => (float) $crane->meter_value,
            'has_defects' => false,
            'critical_defects_count' => 0,
            'signature_captured' => true,
            'remarks' => $remarks,
            'completed_at' => now(),
        ]);
    }

    private function requestFuel(DispatchJob $job, User $operator, OperationalAsset $crane, int $shiftId, int $litres, string $purpose, int $level): FuelRequest
    {
        return app(SubmitMobileFuelRequest::class)->handle($operator, [
            'client_request_id' => (string) Str::uuid(),
            'dispatch_job_id' => $job->id,
            'operational_asset_id' => $crane->id,
            'operator_shift_id' => $shiftId,
            'quantity_litres' => $litres,
            'fuel_type' => 'diesel',
            'purpose' => $purpose,
            'urgency' => 'normal',
            'needed_by' => now()->addHour()->toIso8601String(),
            'current_fuel_level_percent' => $level,
        ]);
    }

    /** @param array<string, mixed> $log */
    private function fuelStep(FuelRequest $fuel, User $actor, FuelRequestStatus $next, ?string $reason = null, array $log = []): void
    {
        app(TransitionFuelRequest::class)->handle($actor, $fuel->refresh(), $next, $reason, $log);
    }

    private function at(Carbon $moment): void
    {
        Carbon::setTestNow($moment);
    }

    // ---------------------------------------------------------------------
    // Reference data
    // ---------------------------------------------------------------------

    private function seedPeople(): void
    {
        $this->dispatcher = $this->account('dispatcher.linking', 'Dispatcher – Asset Linking', RoleName::OperationsManager);
        $this->approver = $this->account('ops.approver', 'Operations Manager – Approvals', RoleName::OperationsManager);

        $crew = [
            ['operator.rsantos', 'Rodel Santos', RoleName::CraneOperator, 'operator_certification', 'TESDA NC II Mobile Crane Operation'],
            ['operator.jvillanueva', 'Jomar Villanueva', RoleName::CraneOperator, 'operator_certification', 'TESDA NC II Mobile Crane Operation'],
            ['rigger.mbautista', 'Mark Bautista', RoleName::Rigger, 'rigger_certification', 'TESDA NC II Rigging'],
            ['rigger.egarcia', 'Edwin Garcia', RoleName::Rigger, 'rigger_certification', 'TESDA NC II Rigging'],
            ['rigger.alim', 'Arnel Lim', RoleName::Rigger, 'rigger_certification', 'TESDA NC II Rigging'],
        ];

        foreach ($crew as $index => [$username, $name, $role, $kind, $type]) {
            $person = $this->account($username, $name, $role);
            $person->personnelProfile()->create(['employee_number' => sprintf('DEF-%03d', $index + 1), 'availability_status' => 'available']);
            $person->personnelCredentials()->create([
                'kind' => $kind,
                'credential_number' => sprintf('TESDA-%s-%04d', strtoupper(substr($kind, 0, 3)), 2100 + $index),
                'credential_type' => $type,
                'status' => 'active',
                'issued_at' => now()->subYear(),
                'expires_at' => now()->addYears(2),
            ]);
            $this->crew[$username] = $person;
        }
    }

    private function account(string $username, string $name, RoleName $role): User
    {
        $user = User::query()->create([
            'name' => $name,
            'username' => $username,
            'email' => $username.'@example.com',
            'password' => Hash::make(self::PASSWORD),
            'is_active' => true,
            'email_verified_at' => now(),
        ]);
        $user->syncRoles([$role->value]);

        return $user;
    }

    private function seedCranes(): void
    {
        $fleet = [
            // code => [name, manufacturer, model, capacity t, subtype, hour meter, burn L/hr]
            'DEF-CRN-2501' => ['25T Truck Crane', 'XCMG', 'XCT25L5', 25, 'Truck-Mounted', 3120.0, 14.0],
            'DEF-CRN-5002' => ['50T All-Terrain Crane', 'Tadano', 'ATF 50G-3', 50, 'All-Terrain', 1860.0, 18.5],
            'DEF-CRN-3003' => ['35T Rough-Terrain Crane', 'Kato', 'KR-35H', 35, 'Rough-Terrain', 4210.0, 16.0],
            'DEF-CRN-2504' => ['25T Truck Crane', 'Zoomlion', 'ZTC250', 25, 'Truck-Mounted', 2575.0, 14.0],
            'DEF-CRN-8005' => ['80T Rough-Terrain Crane', 'Tadano', 'GR-800EX', 80, 'Rough-Terrain', 2190.0, 22.0],
            'DEF-CRN-5006' => ['50T All-Terrain Crane', 'Liebherr', 'LTM 1050-3.1', 50, 'All-Terrain', 1420.0, 18.0],
            'DEF-CRN-2507' => ['25T Truck Crane', 'SANY', 'STC250', 25, 'Truck-Mounted', 980.0, 13.5],
        ];

        foreach ($fleet as $code => [$name, $make, $model, $capacity, $subtype, $hours, $burn]) {
            $crane = OperationalAsset::query()->create([
                'code' => $code,
                'name' => "{$make} {$name}",
                'kind' => 'crane',
                'subtype' => $subtype,
                'status' => AssetStatus::Available,
                'registration_number' => 'PH-'.substr($code, -4),
                'manufacturer' => $make,
                'model' => $model,
                'rated_capacity' => $capacity,
                'capacity_unit' => 'tonnes',
                'meter_type' => 'hour_meter',
                'meter_value' => $hours,
                'baseline_burn_rate' => $burn,
                'burn_rate_unit' => 'L/hr',
                'location' => 'Main Yard – Valenzuela City',
            ]);
            $crane->inspections()->create([
                'technician_id' => $this->approver->id,
                'type' => 'daily_safety',
                'result' => 'passed',
                'checklist' => ['load_test_certificate' => true, 'wire_rope' => true, 'outriggers' => true, 'lmi_system' => true],
                'completed_at' => now()->subDays(6)->setTime(16, 0),
            ]);
            $this->cranes[$code] = $crane;
        }
    }

    private function client(string $key): Client
    {
        $clients = [
            'bayview' => ['C1-CL-0012', 'Bayview Towers Development Corp.', 'Engr. Liza Manalo', '+63 917 555 0112'],
            'northgate' => ['C1-CL-0027', 'Northgate Logistics Park Inc.', 'Dante Robles', '+63 918 555 0127'],
            'sanroque' => ['C1-CL-0031', 'San Roque Water Builders', 'Engr. Paolo Reyes', '+63 919 555 0131'],
            'mabini' => ['C1-CL-0044', 'Mabini Steel Fabricators', 'Grace Mabini', '+63 920 555 0144'],
            'lagunasolar' => ['C1-CL-0052', 'Laguna Solar Farm Builders', 'Engr. Ramon Tan', '+63 921 555 0152'],
            'pampanga' => ['C1-CL-0063', 'Pampanga Cold Storage Co.', 'Joy Dizon', '+63 922 555 0163'],
        ];
        [$code, $company, $contact, $phone] = $clients[$key];

        return Client::query()->firstOrCreate(['code' => $code], [
            'company_name' => $company,
            'contact_person' => $contact,
            'phone' => $phone,
            'email' => Str::slug($contact, '.').'@example.com',
            'address' => 'Metro Manila, Philippines',
            'status' => 'active',
        ]);
    }
}
