<?php

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Carbon\Carbon;
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
                    'current_duty_status_label',
                    'duty_status',
                    'duty_status_label',
                    'current_duty_started_at',
                    'last_accepted_duty_at',
                    'shift_elapsed_minutes',
                    'operating_minutes',
                    'driving_minutes',
                    'standby_minutes',
                    'break_minutes',
                    'daily_operating_hours',
                    'limit_counter_minutes',
                    'limit_counter_label',
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

it('includes the pre-midnight duty period for an active overnight shift', function (): void {
    $now = Carbon::parse('2026-09-14 02:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $earlierShift = OperatorShift::create([
        'user_id' => $operator->id,
        'status' => ShiftStatus::COMPLETED,
        'started_at' => $now->copy()->subDay()->setTime(21, 0),
        'ended_at' => $now->copy()->subDay()->setTime(23, 0),
    ]);

    $earlierLog = OperatorDutyLog::create([
        'operator_shift_id' => $earlierShift->id,
        'user_id' => $operator->id,
        'duty_status' => DutyStatus::OFF_DUTY,
        'started_at' => $now->copy()->subDay()->setTime(22, 0),
        'ended_at' => $now->copy()->subDay()->setTime(23, 0),
        'duration_minutes' => 60,
    ]);

    $shift = OperatorShift::create([
        'user_id' => $operator->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => $now->copy()->subDay()->setTime(23, 45),
    ]);

    $preMidnightLog = OperatorDutyLog::create([
        'operator_shift_id' => $shift->id,
        'user_id' => $operator->id,
        'duty_status' => DutyStatus::OPERATING,
        'started_at' => $now->copy()->subDay()->setTime(23, 30),
        'ended_at' => $now->copy()->setTime(0, 30),
        'duration_minutes' => 60,
    ]);

    $activeLog = OperatorDutyLog::create([
        'operator_shift_id' => $shift->id,
        'user_id' => $operator->id,
        'duty_status' => DutyStatus::DRIVING,
        'started_at' => $now->copy()->setTime(0, 30),
    ]);

    $response = $this->withToken($token)
        ->getJson('/api/v1/hos/current-shift');

    $response->assertOk()
        ->assertJsonPath('data.clocks.shift_active', true)
        ->assertJsonPath('data.clocks.current_duty_status', 'driving');

    $timelineSegments = $response->json('data.clocks.timeline_segments');
    $recentLogs = $response->json('data.clocks.recent_logs');

    expect(array_column($timelineSegments, 'id'))
        ->toBe([$preMidnightLog->id, $activeLog->id])
        ->not->toContain($earlierLog->id)
        ->and($timelineSegments[0]['started_at'])->toBe($preMidnightLog->started_at->toIso8601String())
        ->and($timelineSegments[0]['duration_minutes'])->toBe(60)
        ->and(array_column($recentLogs, 'id'))
        ->toBe([$activeLog->id, $preMidnightLog->id])
        ->not->toContain($earlierLog->id)
        ->and($recentLogs[1]['started_at'])->toBe('11:30 PM')
        ->and($recentLogs[1]['duration_formatted'])->toBe('1h 00m');
});

it('includes the pre-midnight duty period for a completed overnight shift', function (): void {
    $now = Carbon::parse('2026-09-14 02:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;

    $earlierShift = OperatorShift::create([
        'user_id' => $operator->id,
        'status' => ShiftStatus::COMPLETED,
        'started_at' => $now->copy()->subDay()->setTime(21, 0),
        'ended_at' => $now->copy()->subDay()->setTime(23, 0),
    ]);

    $earlierLog = OperatorDutyLog::create([
        'operator_shift_id' => $earlierShift->id,
        'user_id' => $operator->id,
        'duty_status' => DutyStatus::OFF_DUTY,
        'started_at' => $now->copy()->subDay()->setTime(22, 0),
        'ended_at' => $now->copy()->subDay()->setTime(23, 0),
        'duration_minutes' => 60,
    ]);

    $shift = OperatorShift::create([
        'user_id' => $operator->id,
        'status' => ShiftStatus::COMPLETED,
        'started_at' => $now->copy()->subDay()->setTime(23, 45),
        'ended_at' => $now->copy()->setTime(1, 15),
        'is_certified' => true,
        'certified_at' => $now->copy()->setTime(1, 15),
        'certification_statement' => 'I certify this overnight shift record.',
    ]);

    $preMidnightLog = OperatorDutyLog::create([
        'operator_shift_id' => $shift->id,
        'user_id' => $operator->id,
        'duty_status' => DutyStatus::OPERATING,
        'started_at' => $now->copy()->subDay()->setTime(23, 30),
        'ended_at' => $now->copy()->setTime(0, 30),
        'duration_minutes' => 60,
    ]);

    $completedLog = OperatorDutyLog::create([
        'operator_shift_id' => $shift->id,
        'user_id' => $operator->id,
        'duty_status' => DutyStatus::DRIVING,
        'started_at' => $now->copy()->setTime(0, 30),
        'ended_at' => $now->copy()->setTime(1, 15),
        'duration_minutes' => 45,
    ]);

    $response = $this->withToken($token)
        ->getJson('/api/v1/hos/current-shift');

    $response->assertOk()
        ->assertJsonPath('data.clocks.shift_active', false)
        ->assertJsonPath('data.clocks.current_duty_status', 'off_duty')
        ->assertJsonPath('data.clocks.is_certified', true);

    $timelineSegments = $response->json('data.clocks.timeline_segments');
    $recentLogs = $response->json('data.clocks.recent_logs');

    expect(array_column($timelineSegments, 'id'))
        ->toBe([$preMidnightLog->id, $completedLog->id])
        ->not->toContain($earlierLog->id)
        ->and($timelineSegments[0]['started_at'])->toBe($preMidnightLog->started_at->toIso8601String())
        ->and($timelineSegments[0]['duration_minutes'])->toBe(60)
        ->and(array_column($recentLogs, 'id'))
        ->toBe([$completedLog->id, $preMidnightLog->id])
        ->not->toContain($earlierLog->id)
        ->and($recentLogs[1]['started_at'])->toBe('11:30 PM')
        ->and($recentLogs[1]['duration_formatted'])->toBe('1h 00m');
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

it('preserves event occurrence time while exposing server acceptance and active intervals', function (): void {
    $now = Carbon::parse('2026-09-21 12:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $shiftStartedAt = $now->copy()->subHours(2);
    $drivingStartedAt = $now->copy()->subHour();

    $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
            'occurred_at' => $shiftStartedAt->toIso8601String(),
        ])
        ->assertCreated();

    $response = $this->withToken($token)
        ->postJson('/api/v1/hos/duty-status', [
            'duty_status' => 'driving',
            'occurred_at' => $drivingStartedAt->toIso8601String(),
        ]);

    $response->assertOk()
        ->assertJsonPath('data.clocks.shift_elapsed_minutes', 120)
        ->assertJsonPath('data.clocks.operating_minutes', 60)
        ->assertJsonPath('data.clocks.driving_minutes', 60)
        ->assertJsonPath('data.clocks.standby_minutes', 0)
        ->assertJsonPath('data.clocks.break_minutes', 0)
        ->assertJsonPath('data.clocks.limit_counter_minutes', 120)
        ->assertJsonPath('data.clocks.limit_counter_label', 'Operating + driving')
        ->assertJsonPath('data.clocks.current_duty_started_at', $drivingStartedAt->toIso8601String());

    $acceptedAt = Carbon::parse((string) $response->json('data.clocks.last_accepted_duty_at'));

    expect($acceptedAt)->toEqual($now)
        ->and($response->json('data.shift.active_duty.started_at'))->toBe($drivingStartedAt->toIso8601String())
        ->and($response->json('data.shift.active_duty.accepted_at'))->toBe($now->toIso8601String());
});

it('rejects a delayed duty event that would reopen a completed shift', function (): void {
    $now = Carbon::parse('2026-09-21 12:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $shiftStartedAt = $now->copy()->subHours(4);
    $shiftEndedAt = $now->copy()->subHours(2);

    $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
            'occurred_at' => $shiftStartedAt->toIso8601String(),
        ])
        ->assertCreated();

    $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/certify', [
            'occurred_at' => $shiftEndedAt->toIso8601String(),
            'certification_statement' => 'The completed duty record is accurate.',
        ])
        ->assertOk();

    $this->withToken($token)
        ->postJson('/api/v1/hos/duty-status', [
            'duty_status' => 'driving',
            'occurred_at' => $shiftEndedAt->copy()->subMinute()->toIso8601String(),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('occurred_at');

    expect(OperatorShift::query()->where('user_id', $operator->id)->count())->toBe(1)
        ->and(OperatorShift::query()->where('user_id', $operator->id)->value('status'))->toBe(ShiftStatus::COMPLETED);
});

it('does not reopen a completed shift at the exact completion boundary', function (): void {
    $now = Carbon::parse('2026-09-21 12:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $shiftStartedAt = $now->copy()->subHours(4);
    $shiftEndedAt = $now->copy()->subHours(2);

    $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/start', [
            'duty_status' => 'operating',
            'occurred_at' => $shiftStartedAt->toIso8601String(),
        ])
        ->assertCreated();

    $this->withToken($token)
        ->postJson('/api/v1/hos/shifts/certify', [
            'occurred_at' => $shiftEndedAt->toIso8601String(),
            'certification_statement' => 'The completed duty record is accurate.',
        ])
        ->assertOk();

    $this->withToken($token)
        ->postJson('/api/v1/hos/duty-status', [
            'duty_status' => 'driving',
            'occurred_at' => $shiftEndedAt->toIso8601String(),
        ])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('occurred_at');

    expect(OperatorShift::query()->where('user_id', $operator->id)->count())->toBe(1)
        ->and(OperatorShift::query()->where('user_id', $operator->id)->value('status'))->toBe(ShiftStatus::COMPLETED);
});

it('uses the canonical nine-hour warning and ten-hour cap boundaries', function (): void {
    $now = Carbon::parse('2026-09-21 12:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $shift = OperatorShift::query()->create([
        'user_id' => $operator->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => $now->copy()->subHours(9),
        'break_minutes' => 120,
    ]);
    OperatorDutyLog::query()->create([
        'user_id' => $operator->id,
        'operator_shift_id' => $shift->id,
        'duty_status' => DutyStatus::OPERATING,
        'started_at' => $now->copy()->subHours(9),
    ]);

    $warning = $this->withToken($token)->getJson('/api/v1/hos/current-shift');
    $warning->assertOk()
        ->assertJsonPath('data.clocks.dole_warning', true)
        ->assertJsonPath('data.clocks.fatigue_status', 'warning');

    $this->travel(1)->hours();

    $cap = $this->withToken($token)->getJson('/api/v1/hos/current-shift');
    $cap->assertOk()
        ->assertJsonPath('data.clocks.dole_warning', true)
        ->assertJsonPath('data.clocks.fatigue_status', 'critical');
});

it('does not count break time toward the operating limit counter', function (): void {
    $now = Carbon::parse('2026-09-21 12:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $shift = OperatorShift::query()->create([
        'user_id' => $operator->id,
        'status' => ShiftStatus::ACTIVE,
        'started_at' => $now->copy()->subHours(10),
        'operating_minutes' => 480,
    ]);
    OperatorDutyLog::query()->create([
        'user_id' => $operator->id,
        'operator_shift_id' => $shift->id,
        'duty_status' => DutyStatus::ON_BREAK,
        'started_at' => $now->copy()->subHours(2),
    ]);

    $response = $this->withToken($token)->getJson('/api/v1/hos/current-shift');

    $response->assertOk()
        ->assertJsonPath('data.clocks.shift_elapsed_minutes', 600)
        ->assertJsonPath('data.clocks.limit_counter_minutes', 480)
        ->assertJsonPath('data.clocks.dole_warning', false)
        ->assertJsonPath('data.clocks.fatigue_status', 'normal');
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

it('records every accepted duty transition as a non-overlapping interval with event location snapshots', function (): void {
    $now = Carbon::parse('2026-09-22 12:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $asset = OperationalAsset::query()->create([
        'code' => 'CRN-HOS-01',
        'name' => 'HOS test crane',
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
        'meter_type' => 'engine_hours',
        'meter_value' => 123.4,
    ]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $start = $now->copy()->setTime(8, 0);
    $driving = $start->copy()->addHour();
    $standby = $driving->copy()->addHour();
    $break = $standby->copy()->addHour();

    $this->withToken($token)->postJson('/api/v1/hos/shifts/start', [
        'operational_asset_id' => $asset->id,
        'duty_status' => 'operating',
        'occurred_at' => $start->toIso8601String(),
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 8.5,
        'location_observed_at' => $start->toIso8601String(),
        'location_source' => 'gps',
    ])->assertCreated();

    // Re-selecting the accepted state is a duplicate command, not another
    // zero-length interval.
    $this->withToken($token)->postJson('/api/v1/hos/duty-status', [
        'operational_asset_id' => $asset->id,
        'duty_status' => 'operating',
        'occurred_at' => $start->toIso8601String(),
    ])->assertOk();

    $this->withToken($token)->postJson('/api/v1/hos/duty-status', [
        'operational_asset_id' => $asset->id,
        'duty_status' => 'driving',
        'occurred_at' => $driving->toIso8601String(),
        'latitude' => 14.6005,
        'longitude' => 120.9852,
        'location_observed_at' => $driving->toIso8601String(),
        'location_source' => 'gps',
    ])->assertOk();

    $this->withToken($token)->postJson('/api/v1/hos/duty-status', [
        'operational_asset_id' => $asset->id,
        'duty_status' => 'standby',
        'standby_reason' => 'waiting_on_client',
        'occurred_at' => $standby->toIso8601String(),
        'location_source' => 'permission_denied',
    ])->assertOk();

    $this->withToken($token)->postJson('/api/v1/hos/duty-status', [
        'operational_asset_id' => $asset->id,
        'duty_status' => 'on_break',
        'occurred_at' => $break->toIso8601String(),
        'latitude' => 14.6015,
        'longitude' => 120.9862,
        'location_observed_at' => $break->copy()->subHours(2)->toIso8601String(),
        'location_source' => 'last_known',
    ])->assertOk();

    $response = $this->withToken($token)->postJson('/api/v1/hos/shifts/certify', [
        'operational_asset_id' => $asset->id,
        'certification_statement' => 'I certify the complete duty record.',
        'occurred_at' => $now->toIso8601String(),
        'location_source' => 'unavailable',
    ]);

    $response->assertOk()
        ->assertJsonPath('data.shift.status', 'completed')
        ->assertJsonPath('data.shift.duty_logs.0.previous_duty_status', null)
        ->assertJsonPath('data.shift.duty_logs.1.previous_duty_status', 'operating')
        ->assertJsonPath('data.shift.duty_logs.4.new_duty_status', 'off_duty')
        ->assertJsonPath('data.shift.duty_logs.4.location_label', 'Location unavailable');

    $logs = OperatorDutyLog::query()
        ->where('user_id', $operator->id)
        ->orderBy('started_at')
        ->get();

    expect($logs)->toHaveCount(5)
        ->and($logs->pluck('duty_status')->map->value->all())->toBe([
            'operating',
            'driving',
            'standby',
            'on_break',
            'off_duty',
        ])
        ->and($logs->pluck('previous_duty_status')->map(fn ($status) => $status?->value)->all())->toBe([
            null,
            'operating',
            'driving',
            'standby',
            'on_break',
        ])
        ->and($logs->get(0)->duration_minutes)->toBe(60)
        ->and($logs->get(1)->duration_minutes)->toBe(60)
        ->and($logs->get(2)->duration_minutes)->toBe(60)
        ->and($logs->get(3)->duration_minutes)->toBe(60)
        ->and($logs->get(4)->duration_minutes)->toBe(0)
        ->and($logs->get(0)->ended_at)->toEqual($logs->get(1)->started_at)
        ->and($logs->get(1)->ended_at)->toEqual($logs->get(2)->started_at)
        ->and($logs->get(2)->ended_at)->toEqual($logs->get(3)->started_at)
        ->and($logs->get(3)->ended_at)->toEqual($logs->get(4)->started_at)
        ->and($logs->get(0)->location_freshness)->toBe('fresh')
        ->and($logs->get(2)->location_freshness)->toBe('unavailable')
        ->and($logs->get(3)->location_freshness)->toBe('last_known')
        ->and($logs->get(4)->accepted_at)->toEqual($now)
        ->and($asset->refresh()->meter_value)->toBe('123.40');
});

it('keeps the original delayed event location and rejects invalid location timestamps', function (): void {
    $now = Carbon::parse('2026-09-22 12:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $eventAt = $now->copy()->subHours(2);

    $this->withToken($token)->postJson('/api/v1/hos/shifts/start', [
        'duty_status' => 'operating',
        'occurred_at' => $eventAt->toIso8601String(),
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'location_observed_at' => $eventAt->toIso8601String(),
        'location_source' => 'gps',
    ])->assertCreated();

    $this->withToken($token)->postJson('/api/v1/hos/duty-status', [
        'duty_status' => 'driving',
        'occurred_at' => $eventAt->copy()->addHour()->toIso8601String(),
        'latitude' => 14.7005,
        'longitude' => 121.0852,
        'location_observed_at' => $eventAt->copy()->addHour()->toIso8601String(),
        'location_source' => 'gps',
    ])->assertOk()
        ->assertJsonPath('data.shift.active_duty.latitude', '14.7005000')
        ->assertJsonPath('data.shift.active_duty.location_source', 'gps');

    $this->withToken($token)->postJson('/api/v1/hos/duty-status', [
        'duty_status' => 'standby',
        'latitude' => 14.5,
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('longitude');

    $this->withToken($token)->postJson('/api/v1/hos/duty-status', [
        'duty_status' => 'standby',
        'latitude' => 14.5,
        'longitude' => 120.9,
        'location_observed_at' => $now->copy()->addMinutes(10)->toIso8601String(),
        'location_source' => 'gps',
    ])->assertUnprocessable()
        ->assertJsonValidationErrors('location_observed_at');
});

it('returns separate accepted equipment durations without inventing usage hours when no policy exists', function (): void {
    config(['hours_of_service.equipment_usage_policies' => []]);
    $now = Carbon::parse('2026-09-22 12:00:00');
    $this->travelTo($now);

    /** @var User $operator */
    $operator = User::factory()->create(['is_active' => true]);
    $asset = OperationalAsset::query()->create([
        'code' => 'TRK-HOS-01',
        'name' => 'HOS test truck',
        'kind' => 'truck',
        'status' => AssetStatus::Available,
        'meter_type' => 'engine_hours',
        'meter_value' => 55,
    ]);
    $token = $operator->createToken('Mobile Token')->plainTextToken;
    $start = $now->copy()->subHour();

    $this->withToken($token)->postJson('/api/v1/hos/shifts/start', [
        'operational_asset_id' => $asset->id,
        'duty_status' => 'operating',
        'occurred_at' => $start->toIso8601String(),
    ])->assertCreated();

    $response = $this->withToken($token)->getJson('/api/v1/hos/current-shift');

    $response->assertOk()
        ->assertJsonPath('data.clocks.equipment_usage.policy_applied', false)
        ->assertJsonPath('data.clocks.equipment_usage.estimated_minutes', null)
        ->assertJsonPath('data.clocks.equipment_usage.operating_minutes', 60)
        ->assertJsonPath('data.clocks.equipment_usage.driving_minutes', 0);

    expect($asset->refresh()->meter_value)->toBe('55.00');
});
