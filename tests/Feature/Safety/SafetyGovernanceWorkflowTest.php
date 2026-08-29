<?php

use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use App\Platform\Safety\Models\CriticalLiftPlan;
use App\Platform\Safety\Models\SiteHazardTicket;
use App\Platform\Safety\Models\ToolboxMeeting;
use App\Platform\Safety\Models\WorkStoppageNotice;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('allows Field Foreman to submit a daily DOLE Toolbox Meeting with attendee roster', function (): void {
    $foreman = User::factory()->create(['name' => 'Foreman Carlo']);
    $foreman->syncRoles([RoleName::FieldForeman->value]);
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
        ->postJson('/api/v1/safety/toolbox-meetings', $payload)
        ->assertCreated();

    $meeting = ToolboxMeeting::query()->sole();
    expect($meeting->project_site)->toBe('Makati Sky Tower 2')
        ->and($meeting->conductor_id)->toBe($foreman->id)
        ->and($meeting->attendee_count)->toBe(3)
        ->and($meeting->audit_hash)->not->toBeNull()
        ->and($meeting->safety_officer_signed_at)->toBeNull();
});

it('allows Safety Officer to co-sign a submitted Toolbox Meeting', function (): void {
    $foreman = User::factory()->create(['name' => 'Foreman Carlo']);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    $safetyOfficer = User::factory()->create(['name' => 'Engr. Morales (SO-3)']);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    $meeting = ToolboxMeeting::query()->create([
        'project_site' => 'Makati Sky Tower 2',
        'topic_id' => 'tbm-dole-01',
        'topic_title' => 'DOLE D.O. 13: Critical Lifting Clearance',
        'topic_category' => 'Lifting & Rigging',
        'conductor_id' => $foreman->id,
        'conductor_role' => 'Field Foreman',
        'attendee_ids' => ['op-101', 'rig-202'],
        'attendee_count' => 2,
    ]);

    $this->withToken($soToken)
        ->postJson("/api/v1/safety/toolbox-meetings/{$meeting->id}/cosign")
        ->assertOk();

    expect($meeting->fresh()->safety_officer_id)->toBe($safetyOfficer->id)
        ->and($meeting->fresh()->safety_officer_signed_at)->not->toBeNull();
});

it('allows Field Foreman to create a Critical Lift Plan and Safety Officer to authorize it', function (): void {
    $foreman = User::factory()->create(['name' => 'Foreman Dave']);
    $foreman->syncRoles([RoleName::FieldForeman->value]);
    $foremanToken = $foreman->createToken('Mobile')->plainTextToken;

    $safetyOfficer = User::factory()->create(['name' => 'Safety Officer John']);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);
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
        ->postJson('/api/v1/safety/lift-plans', $payload)
        ->assertCreated();

    $plan = CriticalLiftPlan::query()->sole();
    expect($plan->status)->toBe('pending_so_review')
        ->and($plan->load_percentage_of_capacity)->toBe(79.69)
        ->and($plan->foreman_id)->toBe($foreman->id);

    // 2. Safety Officer authorizes permit
    $this->app['auth']->forgetGuards();
    $this->withToken($soToken)
        ->postJson("/api/v1/safety/lift-plans/{$plan->id}/authorize", ['decision' => 'approve'])
        ->assertOk();

    expect($plan->fresh()->status)->toBe('approved')
        ->and($plan->fresh()->safety_officer_id)->toBe($safetyOfficer->id);
});

it('allows Safety Officer to issue and lift a statutory Work Stoppage Order', function (): void {
    $safetyOfficer = User::factory()->create(['name' => 'Safety Officer John', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    // 1. Issue Work Stoppage
    $wsoPayload = [
        'project_site' => 'Substation 4 Transformer Yard',
        'reason' => 'Hydraulic line leak on primary crane outrigger during 40T transformer lift.',
        'affected_area' => 'Transformer Yard Grid C-2',
    ];

    $this->withToken($soToken)
        ->postJson('/api/v1/safety/work-stoppages', $wsoPayload)
        ->assertCreated();

    $notice = WorkStoppageNotice::query()->sole();
    expect($notice->is_active)->toBeTrue()
        ->and($notice->safety_officer_id)->toBe($safetyOfficer->id);

    // 2. Lift Work Stoppage after rectification
    $this->withToken($soToken)
        ->postJson("/api/v1/safety/work-stoppages/{$notice->id}/lift", [
            'lift_reason' => 'Hydraulic line replaced and pressure-tested up to 350 bar. Verified safe by master mechanic.',
        ])
        ->assertOk();

    expect($notice->fresh()->is_active)->toBeFalse()
        ->and($notice->fresh()->lifted_by)->toBe($safetyOfficer->id);
});

it('logs site hazard tickets and tracks rectification', function (): void {
    $foreman = User::factory()->create(['name' => 'Foreman Dave', 'is_active' => true]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);
    $foremanToken = $foreman->createToken('Mobile')->plainTextToken;

    $safetyOfficer = User::factory()->create(['name' => 'Safety Officer John', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    $hazardPayload = [
        'project_site' => 'Makati Sky Tower 2',
        'category' => 'rigging_tackle',
        'severity' => 'moderate',
        'description' => 'Damaged synthetic web sling found near rigging locker.',
        'location_detail' => 'Ground Floor Rigging Bay',
        'corrective_action_required' => 'Destroy and tag out damaged sling.',
    ];

    $this->withToken($foremanToken)
        ->postJson('/api/v1/safety/hazards', $hazardPayload)
        ->assertCreated();

    $ticket = SiteHazardTicket::query()->sole();
    expect($ticket->status)->toBe('open');

    // Rectify ticket
    $this->app['auth']->forgetGuards();
    $this->withToken($soToken)
        ->postJson("/api/v1/safety/hazards/{$ticket->id}/rectify")
        ->assertOk();

    expect($ticket->fresh()->status)->toBe('rectified')
        ->and($ticket->fresh()->rectified_by)->toBe($safetyOfficer->id);
});

it('allows Safety Officer to reject an unsafe Critical Lift Plan with a mandatory condition note', function (): void {
    $foreman = User::factory()->create(['name' => 'Foreman Dave', 'is_active' => true]);
    $foreman->syncRoles([RoleName::FieldForeman->value]);

    $safetyOfficer = User::factory()->create(['name' => 'Safety Officer John', 'is_active' => true]);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);
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
        ->postJson("/api/v1/safety/lift-plans/{$plan->id}/authorize", [
            'decision' => 'reject',
            'reason' => 'Ground bearing capacity unverified; exceeds 85% safety threshold without engineered steel plates.',
        ])
        ->assertOk();

    expect($plan->fresh()->status)->toBe('rejected')
        ->and($plan->fresh()->rejection_reason)->toContain('Ground bearing capacity unverified')
        ->and($plan->fresh()->safety_officer_id)->toBe($safetyOfficer->id);
});

it('enforces RBAC preventing Crane Operators from approving lift plans or issuing work stoppages', function (): void {
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
        ->postJson("/api/v1/safety/lift-plans/{$plan->id}/authorize", ['decision' => 'approve'])
        ->assertForbidden();

    // Operator cannot issue statutory work stoppage (403 Forbidden)
    $this->withToken($opToken)
        ->postJson('/api/v1/safety/work-stoppages', [
            'project_site' => 'Makati Sky Tower 2',
            'reason' => 'Unauthorized halt',
            'affected_area' => 'All',
        ])
        ->assertForbidden();
});

it('provides index endpoints for hazards and critical lift plans', function (): void {
    $safetyOfficer = User::factory()->create(['name' => 'Safety Officer']);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    SiteHazardTicket::query()->create([
        'ticket_code' => 'HAZ-TEST-001',
        'project_site' => 'Site Alpha',
        'reporter_id' => $safetyOfficer->id,
        'category' => 'rigging_tackle',
        'severity' => 'moderate',
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
        ->assertJsonPath('data.0.ticket_code', 'HAZ-TEST-001');

    $this->withToken($soToken)
        ->getJson('/api/v1/safety/lift-plans')
        ->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.lift_reference', 'LIFT-TEST-999');
});

it('computes dynamic safety metrics aggregating TBM attendees and stoppage state', function (): void {
    $safetyOfficer = User::factory()->create(['name' => 'Safety Officer']);
    $safetyOfficer->syncRoles([RoleName::SafetyOfficer->value]);
    $soToken = $safetyOfficer->createToken('SafetyDesk')->plainTextToken;

    ToolboxMeeting::query()->create([
        'project_site' => 'Site Beta',
        'topic_id' => 'tbm-01',
        'topic_title' => 'Electrical clearance',
        'topic_category' => 'Site Environment',
        'conductor_id' => $safetyOfficer->id,
        'conductor_role' => 'Safety Officer',
        'attendee_ids' => ['u1', 'u2', 'u3', 'u4', 'u5'],
        'attendee_count' => 5,
        'audit_hash' => 'dummy-hash',
    ]);

    $this->withToken($soToken)
        ->getJson('/api/v1/safety/metrics')
        ->assertOk()
        ->assertJsonPath('data.safe_man_hours_without_lti', 140040)
        ->assertJsonPath('data.days_without_lti', 384)
        ->assertJsonPath('data.toolbox_meetings_today', 1);
});
