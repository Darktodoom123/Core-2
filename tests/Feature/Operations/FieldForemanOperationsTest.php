use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchPlanVersionStatus;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchAssignmentOffer;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchHandoff;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchPlanVersion;
use App\Modules\Dispatch\Services\DispatchLeadCommandService;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Enums\SosIncidentStatus;
use App\Platform\Safety\Models\SosIncident;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    config(['sos.enabled' => true]);
    Queue::fake();
});

it('provisions Field Foreman with the exact dual-surface permission catalog', function (): void {
    $foreman = User::factory()->create(['name' => 'Bob Foreman']);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    expect($foreman->hasRole(RoleName::FieldForeman->value))->toBeTrue()
        ->and($foreman->operationalRole())->toBe(RoleName::FieldForeman)
        // Web & Schedule visibility
        ->and($foreman->can(PermissionName::DispatchViewAll->value))->toBeTrue()
        ->and($foreman->can(PermissionName::AssignmentsViewAll->value))->toBeTrue()
        ->and($foreman->can(PermissionName::FleetViewAll->value))->toBeTrue()
        ->and($foreman->can(PermissionName::ReportsViewAll->value))->toBeTrue()
        ->and($foreman->can(PermissionName::TrackingViewAll->value))->toBeTrue()
        // Field & Mobile Execution
        ->and($foreman->can(PermissionName::DispatchViewAssigned->value))->toBeTrue()
        ->and($foreman->can(PermissionName::DispatchUpdateOwnStatus->value))->toBeTrue()
        ->and($foreman->can(PermissionName::DispatchRespondOwn->value))->toBeTrue()
        ->and($foreman->can(PermissionName::FuelRequest->value))->toBeTrue()
        ->and($foreman->can(PermissionName::FuelRecord->value))->toBeTrue()
        ->and($foreman->can(PermissionName::FuelForward->value))->toBeTrue()
        ->and($foreman->can(PermissionName::TrackingShareOwn->value))->toBeTrue()
        ->and($foreman->can(PermissionName::ReportsViewOwn->value))->toBeTrue()
        ->and($foreman->can(PermissionName::SosTrigger->value))->toBeTrue()
        ->and($foreman->can(PermissionName::RentalOperate->value))->toBeTrue()
        // Restricted / Non-Foreman actions
        ->and($foreman->can(PermissionName::DispatchCreate->value))->toBeFalse()
        ->and($foreman->can(PermissionName::SalesCreateQuote->value))->toBeFalse()
        ->and($foreman->can(PermissionName::UsersManage->value))->toBeFalse();
});

it('enables Field Foreman to access both Web Workspace and Mobile API surfaces', function (): void {
    $foreman = User::factory()->create(['name' => 'Foreman Marcus', 'is_active' => true, 'email_verified_at' => now()]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    // 1. Web Workspace surface access
    $this->actingAs($foreman)->get('/operations')
        ->assertOk();

    // 2. Mobile API surface access via Sanctum token
    $this->app['auth']->forgetGuards();
    $token = $foreman->createToken('Foreman Rugged Device')->plainTextToken;
    $this->withToken($token)->getJson('/api/v1/auth/me')
        ->assertOk()
        ->assertJsonPath('data.name', 'Foreman Marcus')
        ->assertJsonPath('data.role', RoleName::FieldForeman->value);
});

it('allows Field Foreman to be designated as Lead on a dispatch attempt', function (): void {
    config(['dispatch.v2_commands_enabled' => true, 'dispatch.phase3_commands_enabled' => true]);

    $manager = User::factory()->create(['name' => 'Dispatch Manager', 'is_active' => true, 'email_verified_at' => now()]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $foreman = User::factory()->create(['name' => 'Lead Foreman Dave', 'is_active' => true, 'email_verified_at' => now()]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    PersonnelCredential::query()->create([
        'user_id' => $foreman->id,
        'kind' => 'operator_certification',
        'credential_number' => 'CERT-LEAD-991',
        'credential_type' => 'Master Rigger / Crane Supervisor',
        'status' => 'active',
        'issued_at' => now()->subMonth(),
        'expires_at' => now()->addYear(),
    ]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-LEAD-001',
        'client' => 'Highrise Constructors',
        'title' => 'Tandem Crane Lift',
        'site' => 'Site Alpha',
        'priority' => DispatchPriority::Priority,
        'status' => DispatchStatus::Scheduled,
        'version' => 1,
        'created_by' => $manager->id,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(6),
    ]);

    $handoff = DispatchHandoff::query()->create([
        'workspace_key' => 'default',
        'source_type' => 'legacy_dispatch_job',
        'source_id' => $job->id,
        'source_reference' => $job->reference,
        'legacy_dispatch_job_id' => $job->id,
        'created_by' => $manager->id,
        'compatibility_state' => 'v2_command',
    ]);

    $attempt = DispatchExecutionAttempt::query()->create([
        'handoff_id' => $handoff->id,
        'legacy_dispatch_job_id' => $job->id,
        'workspace_key' => 'default',
        'attempt_number' => 1,
        'status' => DispatchAttemptStatus::Draft,
        'version' => 1,
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(6),
        'created_by' => $manager->id,
    ]);

    $plan = DispatchPlanVersion::query()->create([
        'attempt_id' => $attempt->id,
        'workspace_key' => 'default',
        'version' => 1,
        'status' => DispatchPlanVersionStatus::Draft,
        'snapshot' => ['mandatory_assignments' => [['slot' => 'foreman', 'assignment_type' => 'foreman']]],
        'scheduled_start' => now()->addDay(),
        'scheduled_end' => now()->addDay()->addHours(6),
        'created_by' => $manager->id,
        'submitted_by' => $manager->id,
        'submitted_at' => now(),
        'sealed_at' => now(),
        'content_hash' => hash('sha256', 'foreman-plan-'.$attempt->id),
    ]);

    $offer = DispatchAssignmentOffer::query()->create([
        'attempt_id' => $attempt->id,
        'plan_version_id' => $plan->id,
        'workspace_key' => 'default',
        'user_id' => $foreman->id,
        'assignment_type' => 'foreman',
        'status' => DispatchAssignmentOfferStatus::Accepted,
        'accepted_at' => now(),
    ]);

    $leadService = app(DispatchLeadCommandService::class);
    $mutation = DispatchV2Mutation::forVersion(
        expectedVersion: 1,
        idempotencyKey: (string) Str::uuid(),
        workspaceKey: 'default',
        reason: 'Designating senior site supervisor as lead',
        payload: ['offer_id' => $offer->id],
    );

    $updatedAttempt = $leadService->designate($manager, $attempt, $mutation);
    expect($updatedAttempt->designated_lead_offer_id)->toBe($offer->id);
});

it('allows Field Foreman to trigger on-site SOS emergency distress via mobile', function (): void {
    $manager = User::factory()->create(['name' => 'Ops Manager', 'is_active' => true, 'email_verified_at' => now()]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $foreman = User::factory()->create(['name' => 'Site Foreman Alex', 'is_active' => true, 'email_verified_at' => now()]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);
    $token = $foreman->createToken('Mobile')->plainTextToken;

    $commandId = (string) Str::uuid();
    $response = $this->withToken($token)->withHeader('Idempotency-Key', $commandId)->postJson('/api/v1/sos-incidents', [
        'command_id' => $commandId,
        'worker_note' => 'Sudden ground subsidence near outrigger pad',
        'latitude' => 14.5995,
        'longitude' => 120.9842,
    ])->assertCreated();

    $incident = SosIncident::query()->sole();
    expect($incident->reporter_id)->toBe($foreman->id)
        ->and(in_array($incident->status, [SosIncidentStatus::Active, SosIncidentStatus::Escalated], true))->toBeTrue();
});

it('allows Field Foreman to advance assigned dispatch status on mobile', function (): void {
    $manager = User::factory()->create(['name' => 'Ops Manager', 'is_active' => true, 'email_verified_at' => now()]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $foreman = User::factory()->create(['name' => 'Site Foreman Mark', 'is_active' => true, 'email_verified_at' => now()]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    $job = DispatchJob::query()->create([
        'reference' => 'DSP-STATUS-001',
        'client' => 'City Grid Corp',
        'title' => 'Substation Transformer Placement',
        'site' => 'Substation 4',
        'priority' => DispatchPriority::Routine,
        'status' => DispatchStatus::Accepted,
        'version' => 1,
        'created_by' => $manager->id,
    ]);

    DispatchPersonnelAssignment::query()->create([
        'dispatch_job_id' => $job->id,
        'user_id' => $foreman->id,
        'assignment_type' => 'foreman',
        'response_status' => 'accepted',
        'assigned_by' => $manager->id,
        'active_from' => now()->subMinute(),
    ]);

    $token = $foreman->createToken('Mobile')->plainTextToken;
    $commandId = (string) Str::uuid();

    $this->withToken($token)->withHeader('Idempotency-Key', $commandId)->postJson("/api/v1/dispatch-jobs/{$job->id}/status", [
        'command_id' => $commandId,
        'status' => 'en_route',
        'version' => 1,
    ])->assertOk()
        ->assertJsonPath('data.status.value', 'en_route');

    expect($job->fresh()->status)->toBe(DispatchStatus::EnRoute);
});
