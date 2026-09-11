<?php

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('returns current shift and calculated ELD clocks for an operator', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->getJson('/api/v1/hos/current-shift');

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                'shift',
                'clocks' => [
                    'shift_active',
                    'shift_status',
                    'current_duty_status',
                    'drive_remaining_minutes',
                    'shift_window_remaining_minutes',
                    'break_countdown_minutes',
                    'cycle_remaining_minutes',
                    'cycle_accumulated_minutes',
                    'cycle_limit_minutes',
                    'timeline_segments',
                    'recent_logs',
                    'active_demurrage',
                    'is_certified',
                ],
            ],
        ])
        ->assertJsonPath('data.clocks.shift_active', false)
        ->assertJsonPath('data.clocks.current_duty_status', 'off_duty');
});

it('starts a new operator shift with initial duty status', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $response = $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
            'latitude' => 14.5995,
            'longitude' => 120.9842,
            'location_name' => 'Manila Port Terminal',
            'remarks' => 'Starting morning shift for crane lift operations.',
        ]);

    $response->assertCreated()
        ->assertJsonPath('data.status', 'active')
        ->assertJsonPath('data.active_duty.duty_status', 'operating')
        ->assertJsonPath('data.active_duty.location_name', 'Manila Port Terminal');

    $this->assertDatabaseHas('operator_shifts', [
        'user_id' => $operator->id,
        'status' => 'active',
    ]);

    $this->assertDatabaseHas('operator_duty_logs', [
        'user_id' => $operator->id,
        'duty_status' => 'operating',
    ]);
});

it('transitions duty status and flags billable demurrage for client site delays', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    // Start shift
    $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
        ]);

    // Transition to Standby due to waiting on concrete mixer pour (billable demurrage)
    $response = $this->withToken($token)
        ->postJson('/api/v1/hos/duty-status', [
            'duty_status' => 'standby',
            'standby_reason' => 'waiting_on_concrete',
            'latitude' => 14.5547,
            'longitude' => 121.0244,
            'location_name' => 'Taguig Tower Site',
            'remarks' => 'Concrete mixer delayed in highway traffic.',
        ]);

    $response->assertOk()
        ->assertJsonPath('data.clocks.current_duty_status', 'standby')
        ->assertJsonPath('data.clocks.active_demurrage', true);

    $this->assertDatabaseHas('operator_duty_logs', [
        'user_id' => $operator->id,
        'duty_status' => 'standby',
        'standby_reason' => 'waiting_on_concrete',
        'is_demurrage_billable' => true,
    ]);

    // Transition to Driving
    $response2 = $this->withToken($token)
        ->postJson('/api/v1/hos/duty-status', [
            'duty_status' => 'driving',
            'remarks' => 'Highway transit to yard.',
        ]);

    $response2->assertOk()
        ->assertJsonPath('data.clocks.current_duty_status', 'driving')
        ->assertJsonPath('data.clocks.active_demurrage', false);
});

it('certifies and completes an operator shift with legal operator signature', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    // Start shift
    $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
        ]);

    // Certify and complete shift
    $response = $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/certify', [
            'certification_statement' => 'I certify that these duty status entries and hours of service are true, complete, and accurate for this shift.',
            'remarks' => 'All lifts completed safely with zero incidents.',
        ]);

    $response->assertOk()
        ->assertJsonPath('data.shift.status', 'completed')
        ->assertJsonPath('data.shift.is_certified', true)
        ->assertJsonPath('data.clocks.is_certified', true)
        ->assertJsonPath('data.clocks.shift_active', false);

    $this->assertDatabaseHas('operator_shifts', [
        'user_id' => $operator->id,
        'status' => 'completed',
        'is_certified' => true,
    ]);
});

it('returns 8-day rolling cycle audit history', function (): void {
    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $shift = OperatorShift::create([
        'user_id' => $operator->id,
        'status' => ShiftStatus::COMPLETED,
        'started_at' => now()->subDays(2),
        'ended_at' => now()->subDays(2)->addHours(8),
        'operating_minutes' => 360,
        'driving_minutes' => 120,
    ]);

    OperatorDutyLog::create([
        'operator_shift_id' => $shift->id,
        'user_id' => $operator->id,
        'duty_status' => DutyStatus::OPERATING,
        'started_at' => now()->subDays(2),
        'ended_at' => now()->subDays(2)->addHours(6),
        'duration_minutes' => 360,
    ]);

    $response = $this->withToken($token)
        ->getJson('/api/v1/hos/cycle-history?days=8');

    $response->assertOk()
        ->assertJsonStructure([
            'data' => [
                'days',
                'shifts',
                'logs',
            ],
        ])
        ->assertJsonPath('data.days', 8);
});
