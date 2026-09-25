<?php

use App\Platform\Attachments\Models\Attachment;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\CriticalLiftPlan;
use App\Platform\Safety\Models\SiteHazardTicket;
use App\Platform\Safety\Models\ToolboxMeeting;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
    Storage::fake('private');
});

it('allows Crane Operator to submit a daily DOLE Toolbox Meeting with attendee roster', function (): void {
    $foreman = User::factory()->create(['name' => 'Operator Carlo']);
    $foreman->syncRoles([RoleName::CraneOperator->value]);
    $token = $foreman->createToken('Mobile')->plainTextToken;

    $payload = [
        'project_site' => 'Makati Sky Tower 2',
        'topic_id' => 'tbm-dole-01',
        'topic_title' => 'DOLE D.O. 13: Critical Lifting & Swing Radius Clearance',
        'topic_category' => 'Lifting & Rigging',
        'attendee_ids' => ['op-101', 'rig-202', 'spot-303'],
        'photo_evidence_url' => 'https://storage.alibaton-ph.com/tbm-photos/tbm-8842.jpg',
        'notes' => 'Reviewed 10ft clearance from live electrical lines.',
    ];

    $response = $this->withToken($token)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/safety/toolbox-meetings', $payload)
        ->assertCreated();

    $meeting = ToolboxMeeting::query()->sole();
    expect($meeting->project_site)->toBe('Makati Sky Tower 2')
        ->and($meeting->conductor_id)->toBe($foreman->id)
        ->and($meeting->attendee_count)->toBe(3)
        ->and($meeting->audit_hash)->not->toBeNull()
        ->and($meeting->safety_officer_signed_at)->toBeNull();
});

it('allows Operations Manager to co-sign a submitted Toolbox Meeting', function (): void {
    $foreman = User::factory()->create(['name' => 'Operator Carlo']);
    $foreman->syncRoles([RoleName::CraneOperator->value]);

    $safetyOfficer = User::factory()->create(['name' => 'Engr. Morales (Ops Mgr)']);
    $safetyOfficer->syncRoles([RoleName::OperationsManager->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    $meeting = ToolboxMeeting::query()->create([
        'project_site' => 'Makati Sky Tower 2',
        'topic_id' => 'tbm-dole-01',
        'topic_title' => 'DOLE D.O. 13: Critical Lifting Clearance',
        'topic_category' => 'Lifting & Rigging',
        'conductor_id' => $foreman->id,
        'conductor_role' => 'Operator',
        'attendee_ids' => ['op-101', 'rig-202'],
        'attendee_count' => 2,
    ]);

    $this->withToken($soToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/safety/toolbox-meetings/{$meeting->id}/cosign")
        ->assertOk();

    expect($meeting->fresh()->safety_officer_id)->toBe($safetyOfficer->id)
        ->and($meeting->fresh()->safety_officer_signed_at)->not->toBeNull();
});

it('allows Crane Operator to create a Critical Lift Plan and Operations Manager to authorize it', function (): void {
    $foreman = User::factory()->create(['name' => 'Operator Dave']);
    $foreman->syncRoles([RoleName::CraneOperator->value]);
    $foremanToken = $foreman->createToken('Mobile')->plainTextToken;

    $safetyOfficer = User::factory()->create(['name' => 'Operations Manager John']);
    $safetyOfficer->syncRoles([RoleName::OperationsManager->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    $payload = [
        'project_site' => 'BGC High Street Hub',
        'rigger_tesda_nc_number' => 'TESDA-NC2-RIG-8899',
        'gross_load_weight_tons' => 25.5,
        'crane_rated_capacity_tons' => 32.0,
        'boom_length_meters' => 35.0,
        'working_radius_meters' => 12.0,
        'ground_bearing_condition' => 'Engineered Timber Mats on Compacted Subgrade',
        'weather_wind_speed_kph' => 12.0,
    ];

    // 1. Foreman submits Critical Lift Plan
    $this->withToken($foremanToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/safety/lift-plans', $payload)
        ->assertCreated();

    $plan = CriticalLiftPlan::query()->sole();
    expect($plan->status)->toBe('pending_so_review')
        ->and($plan->load_percentage_of_capacity)->toBe(79.69)
        ->and($plan->foreman_id)->toBe($foreman->id);

    // 2. Safety Officer authorizes permit
    $this->app['auth']->forgetGuards();
    $this->withToken($soToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/safety/lift-plans/{$plan->id}/authorize", ['decision' => 'approve'])
        ->assertOk();

    expect($plan->fresh()->status)->toBe('approved')
        ->and($plan->fresh()->safety_officer_id)->toBe($safetyOfficer->id);
});

it('allows Operations Manager to issue and lift a statutory Work Stoppage Order', function (): void {
    $safetyOfficer = User::factory()->create(['name' => 'Operations Manager John', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::OperationsManager->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    // 1. Issue Work Stoppage
    $wsoPayload = [
        'project_site' => 'Substation 4 Transformer Yard',
        'reason' => 'Hydraulic line leak on primary crane outrigger during 40T transformer lift.',
        'affected_area' => 'Transformer Yard Grid C-2',
    ];

    $this->withToken($soToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/safety/work-stoppages', $wsoPayload)
        ->assertCreated();

    $notice = WorkStoppageNotice::query()->sole();
    expect($notice->is_active)->toBeTrue()
        ->and($notice->issued_by)->toBe($safetyOfficer->id);

    // 2. Lift Work Stoppage after rectification
    $this->withToken($soToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/safety/work-stoppages/{$notice->id}/lift", [
            'lift_reason' => 'Hydraulic line replaced and pressure-tested up to 350 bar. Verified safe by master mechanic.',
        ])
        ->assertOk();

    expect($notice->fresh()->is_active)->toBeFalse()
        ->and($notice->fresh()->lifted_by)->toBe($safetyOfficer->id);
});

it('logs site hazard tickets and tracks rectification', function (): void {
    $foreman = User::factory()->create(['name' => 'Operator Dave', 'is_active' => true]);
    $foreman->syncRoles([RoleName::CraneOperator->value]);
    $foremanToken = $foreman->createToken('Mobile')->plainTextToken;

    $safetyOfficer = User::factory()->create(['name' => 'Operations Manager John', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::OperationsManager->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    $hazardPayload = [
        'project_site' => 'Makati Sky Tower 2',
        'category' => 'rigging_tackle',
        'severity' => 'medium',
        'description' => 'Damaged synthetic web sling found near rigging locker.',
        'location_detail' => 'Ground Floor Rigging Bay',
        'corrective_action_required' => 'Destroy and tag out damaged sling.',
    ];

    $this->withToken($foremanToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/safety/hazards', $hazardPayload)
        ->assertCreated();

    $ticket = SiteHazardTicket::query()->sole();
    expect($ticket->status)->toBe('open');

    // Rectify ticket
    $this->app['auth']->forgetGuards();
    $this->withToken($soToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/safety/hazards/{$ticket->id}/rectify", [
            'rectification_notes' => 'Damaged sling destroyed and replacement inspected before return to service.',
        ])
        ->assertOk();

    expect($ticket->fresh()->status)->toBe('rectified')
        ->and($ticket->fresh()->rectification_notes)->toBe('Damaged sling destroyed and replacement inspected before return to service.')
        ->and($ticket->fresh()->rectified_by)->toBe($safetyOfficer->id);

    expect(AuditEvent::query()->where('action', 'safety.hazard_reported')->exists())->toBeTrue()
        ->and(AuditEvent::query()->where('action', 'safety.hazard_rectified')->exists())->toBeTrue();
});

it('allows Operations Manager to reject an unsafe Critical Lift Plan with a mandatory condition note', function (): void {
    $foreman = User::factory()->create(['name' => 'Operator Dave', 'is_active' => true]);
    $foreman->syncRoles([RoleName::CraneOperator->value]);

    $safetyOfficer = User::factory()->create(['name' => 'Operations Manager John', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::OperationsManager->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    $plan = CriticalLiftPlan::query()->create([
        'lift_reference' => 'LIFT-TEST-999',
        'project_site' => 'Makati Sky Tower 2',
        'rigger_tesda_nc_number' => 'TESDA-NC2-RIG-8899',
        'gross_load_weight_tons' => 29.0,
        'crane_rated_capacity_tons' => 32.0,
        'load_percentage_of_capacity' => 90.62,
        'boom_length_meters' => 35.0,
        'working_radius_meters' => 14.0,
        'ground_bearing_condition' => 'Unverified soil',
        'weather_wind_speed_kph' => 20.0,
        'status' => 'pending_so_review',
        'foreman_id' => $foreman->id,
    ]);

    $this->withToken($soToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/safety/lift-plans/{$plan->id}/authorize", [
            'decision' => 'reject',
            'reason' => 'Ground bearing capacity unverified; exceeds 85% safety threshold without engineered steel plates.',
        ])
        ->assertOk();

    expect($plan->fresh()->status)->toBe('rejected')
        ->and($plan->fresh()->rejection_reason)->toContain('Ground bearing capacity unverified')
        ->and($plan->fresh()->safety_officer_id)->toBe($safetyOfficer->id);
});

it('lets any field worker stop unsafe work while limiting plan approval and stoppage release to managers', function (): void {
    $operator = User::factory()->create(['name' => 'Crane Operator Mike', 'is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $opToken = $operator->createToken('Mobile')->plainTextToken;

    $plan = CriticalLiftPlan::query()->create([
        'lift_reference' => 'LIFT-TEST-888',
        'project_site' => 'Makati Sky Tower 2',
        'rigger_tesda_nc_number' => 'TESDA-NC2-RIG-8899',
        'gross_load_weight_tons' => 15.0,
        'crane_rated_capacity_tons' => 32.0,
        'load_percentage_of_capacity' => 46.88,
        'boom_length_meters' => 25.0,
        'working_radius_meters' => 10.0,
        'ground_bearing_condition' => 'Concrete Pad',
        'weather_wind_speed_kph' => 10.0,
        'status' => 'pending_so_review',
    ]);

    // Operator cannot authorize lift plan (403 Forbidden)
    $this->withToken($opToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/safety/lift-plans/{$plan->id}/authorize", ['decision' => 'approve'])
        ->assertForbidden();

    // Any field worker can stop work when they identify an immediate safety risk.
    $this->withToken($opToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson('/api/v1/safety/work-stoppages', [
            'project_site' => 'Makati Sky Tower 2',
            'reason' => 'Unstable outrigger pad observed under the active crane setup.',
            'affected_area' => 'Grid B-4',
        ])->assertCreated();

    $notice = WorkStoppageNotice::query()->sole();
    expect($notice->issued_by)->toBe($operator->id)
        ->and($notice->is_active)->toBeTrue();

    // Field staff cannot release a stoppage after issuing it.
    $this->withToken($opToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/safety/work-stoppages/{$notice->id}/lift", [
            'lift_reason' => 'The outrigger pad was replaced and checked by the supervisor.',
        ])->assertForbidden();

    $manager = User::factory()->create(['name' => 'Operations Manager', 'is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);
    $managerToken = $manager->createToken('SafetyDesk')->plainTextToken;
    $this->app['auth']->forgetGuards();
    $this->withToken($managerToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())->postJson("/api/v1/safety/work-stoppages/{$notice->id}/lift", [
            'lift_reason' => 'The outrigger pad was replaced and checked by the supervisor.',
        ])->assertOk();

    expect($notice->fresh()->is_active)->toBeFalse()
        ->and($notice->fresh()->lifted_by)->toBe($manager->id);

    // Operators may submit reports but cannot read the organization-wide safety register.
    $this->app['auth']->forgetGuards();
    $this->withToken($opToken)
        ->getJson('/api/v1/safety/hazards')
        ->assertForbidden();
});

it('provides index endpoints for hazards and critical lift plans', function (): void {
    $safetyOfficer = User::factory()->create(['name' => 'Operations Manager']);
    $safetyOfficer->syncRoles([RoleName::OperationsManager->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    SiteHazardTicket::query()->create([
        'ticket_code' => 'HAZ-TEST-001',
        'project_site' => 'Site Alpha',
        'reporter_id' => $safetyOfficer->id,
        'category' => 'rigging_tackle',
        'severity' => 'medium',
        'description' => 'Damaged shackle',
        'location_detail' => 'Bay 1',
        'corrective_action_required' => 'Replace shackle',
        'status' => 'open',
    ]);

    CriticalLiftPlan::query()->create([
        'lift_reference' => 'LIFT-TEST-999',
        'project_site' => 'Site Alpha',
        'rigger_tesda_nc_number' => 'TESDA-001',
        'gross_load_weight_tons' => 10.0,
        'crane_rated_capacity_tons' => 20.0,
        'load_percentage_of_capacity' => 50.0,
        'boom_length_meters' => 20.0,
        'working_radius_meters' => 8.0,
        'ground_bearing_condition' => 'Concrete',
        'status' => 'pending_so_review',
    ]);

    $this->withToken($soToken)
        ->getJson('/api/v1/safety/hazards')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.ticket_code', 'HAZ-TEST-001')
        ->assertJsonMissingPath('data.0.reporter_id')
        ->assertJsonMissingPath('data.0.reporter');

    $this->withToken($soToken)
        ->getJson('/api/v1/safety/lift-plans')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.lift_reference', 'LIFT-TEST-999');
});

it('replays a safety command without creating duplicate records and rejects reused keys for changed input', function (): void {
    $operator = User::factory()->create(['is_active' => true]);
    $operator->syncRoles([RoleName::CraneOperator->value]);
    $token = $operator->createToken('Mobile')->plainTextToken;
    $commandId = (string) Str::uuid();
    $payload = [
        'project_site' => 'Makati Sky Tower 2',
        'category' => 'equipment',
        'severity' => 'medium',
        'description' => 'A cracked guard was found on the mobile crane access platform.',
        'location_detail' => 'Crane 1 access ladder',
        'corrective_action_required' => 'Remove crane from service and replace the guard.',
    ];

    $first = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/safety/hazards', $payload)
        ->assertCreated();
    $replay = $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/safety/hazards', $payload)
        ->assertCreated();

    expect(SiteHazardTicket::query()->count())->toBe(1)
        ->and($replay->json('data.id'))->toBe($first->json('data.id'))
        ->and(AuditEvent::query()->where('action', 'safety.hazard_reported')->count())->toBe(1);

    $this->withToken($token)
        ->withHeader('Idempotency-Key', $commandId)
        ->postJson('/api/v1/safety/hazards', array_merge($payload, ['description' => 'Changed payload with the same command id.']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('command_id');
});

it('reports supported safety counts without fabricating safe-hours or incident-day metrics', function (): void {
    $safetyOfficer = User::factory()->create(['name' => 'Operations Manager']);
    $safetyOfficer->syncRoles([RoleName::OperationsManager->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    ToolboxMeeting::query()->create([
        'project_site' => 'Site Beta',
        'topic_id' => 'tbm-01',
        'topic_title' => 'Electrical clearance',
        'topic_category' => 'Site Environment',
        'conductor_id' => $safetyOfficer->id,
        'conductor_role' => 'Operations Manager',
        'attendee_ids' => ['u1', 'u2', 'u3', 'u4', 'u5'],
        'attendee_count' => 5,
        'audit_hash' => 'dummy-hash',
    ]);

    $this->withToken($soToken)
        ->getJson('/api/v1/safety/metrics')
        ->assertOk()
        ->assertJsonPath('data.safe_man_hours_without_lti', null)
        ->assertJsonPath('data.days_without_lti', null)
        ->assertJsonPath('data.metric_availability.safe_man_hours_without_lti', 'unavailable')
        ->assertJsonPath('data.metric_availability.days_without_lti', 'unavailable')
        ->assertJsonPath('data.toolbox_meetings_today', 1);
});

it('uploads private hazard photos idempotently and restricts evidence access to the reporter and managers', function (): void {
    $reporter = User::factory()->create(['is_active' => true]);
    $reporter->syncRoles([RoleName::CraneOperator->value]);
    $reporterToken = $reporter->createToken('FieldClient')->plainTextToken;

    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);
    $managerToken = $manager->createToken('SafetyDesk')->plainTextToken;

    $otherOperator = User::factory()->create(['is_active' => true]);
    $otherOperator->syncRoles([RoleName::CraneOperator->value]);
    $otherToken = $otherOperator->createToken('FieldClient')->plainTextToken;

    $ticketResponse = $this->withToken($reporterToken)
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->postJson('/api/v1/safety/hazards', [
            'project_site' => 'Pier 7',
            'category' => 'equipment',
            'severity' => 'high',
            'description' => 'A damaged sling was found at the south rigging area.',
            'location_detail' => 'South rigging area',
            'corrective_action_required' => 'Tag it out and replace it before the next lift.',
        ])
        ->assertCreated();
    $ticketId = $ticketResponse->json('data.id');
    $photoCommandId = (string) Str::uuid();
    $photo = UploadedFile::fake()->image('hazard-evidence.png');
    $uploadPayload = [
        'file' => $photo,
        'owner_type' => 'site_hazard_ticket',
        'owner_id' => $ticketId,
        'kind' => 'hazard_photo',
    ];

    $firstUpload = $this->withToken($reporterToken)
        ->withHeader('Accept', 'application/json')
        ->withHeader('Idempotency-Key', $photoCommandId)
        ->post('/api/v1/attachments', $uploadPayload)
        ->assertCreated()
        ->assertJsonPath('data.kind', 'hazard_photo')
        ->assertJsonPath('data.owner_id', $ticketId)
        ->assertJsonMissingPath('data.path')
        ->assertJsonMissingPath('data.checksum_sha256');
    $attachmentId = $firstUpload->json('data.id');

    $replay = $this->withToken($reporterToken)
        ->withHeader('Accept', 'application/json')
        ->withHeader('Idempotency-Key', $photoCommandId)
        ->post('/api/v1/attachments', $uploadPayload)
        ->assertCreated();

    expect(Attachment::query()->count())->toBe(1)
        ->and($replay->json('data.id'))->toBe($attachmentId)
        ->and(Attachment::query()->sole()->disk)->toBe('private');

    $this->app['auth']->forgetGuards();
    $this->withToken($otherToken)
        ->withHeader('Accept', 'application/json')
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->post('/api/v1/attachments', [
            'file' => UploadedFile::fake()->image('unauthorized-evidence.png'),
            'owner_type' => 'site_hazard_ticket',
            'owner_id' => $ticketId,
            'kind' => 'hazard_photo',
        ])
        ->assertForbidden();

    $this->app['auth']->forgetGuards();
    $this->withToken($reporterToken)
        ->withHeader('Accept', 'application/json')
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->post('/api/v1/attachments', [
            'file' => UploadedFile::fake()->create('hazard.pdf', 20, 'application/pdf'),
            'owner_type' => 'site_hazard_ticket',
            'owner_id' => $ticketId,
            'kind' => 'hazard_photo',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['file']);

    expect(Attachment::query()->count())->toBe(1);

    $this->app['auth']->forgetGuards();
    $this->withToken($otherToken)
        ->get('/api/v1/attachments/'.$attachmentId.'/download')
        ->assertForbidden();

    $this->app['auth']->forgetGuards();
    $this->withToken($managerToken)
        ->get('/api/v1/attachments/'.$attachmentId.'/download')
        ->assertOk();

    $this->app['auth']->forgetGuards();
    $this->withToken($managerToken)
        ->getJson('/api/v1/safety/hazards')
        ->assertOk()
        ->assertJsonPath('data.0.id', $ticketId)
        ->assertJsonPath('data.0.photo_attachments.0.id', $attachmentId)
        ->assertJsonPath('data.0.photo_attachments.0.original_filename', 'hazard-evidence.png');

    foreach (range(2, 4) as $index) {
        $this->withToken($reporterToken)
            ->withHeader('Accept', 'application/json')
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post('/api/v1/attachments', [
                'file' => UploadedFile::fake()->image("hazard-evidence-{$index}.png"),
                'owner_type' => 'site_hazard_ticket',
                'owner_id' => $ticketId,
                'kind' => 'hazard_photo',
            ])
            ->assertCreated();
    }

    $this->withToken($reporterToken)
        ->withHeader('Accept', 'application/json')
        ->withHeader('Idempotency-Key', (string) Str::uuid())
        ->post('/api/v1/attachments', [
            'file' => UploadedFile::fake()->image('hazard-evidence-5.png'),
            'owner_type' => 'site_hazard_ticket',
            'owner_id' => $ticketId,
            'kind' => 'hazard_photo',
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('file');

    expect(Attachment::query()->where('owner_id', $ticketId)->where('kind', 'hazard_photo')->count())->toBe(4);
});

it('loads the complete safety manager workspace from one authorized read request', function (): void {
    $manager = User::factory()->create(['is_active' => true]);
    $manager->syncRoles([RoleName::OperationsManager->value]);

    $this->actingAs($manager)
        ->getJson('/operations/safety/overview')
        ->assertOk()
        ->assertJsonPath('data.metrics.metric_availability.safe_man_hours_without_lti', 'unavailable')
        ->assertJsonPath('data.hazards', [])
        ->assertJsonPath('data.liftPlans', [])
        ->assertJsonPath('data.toolboxMeetings', [])
        ->assertJsonPath('data.workStoppages', []);

    $fieldWorker = User::factory()->create(['is_active' => true]);
    $fieldWorker->syncRoles([RoleName::CraneOperator->value]);

    $this->app['auth']->forgetGuards();
    $this->actingAs($fieldWorker)
        ->getJson('/operations/safety/overview')
        ->assertForbidden();
});
