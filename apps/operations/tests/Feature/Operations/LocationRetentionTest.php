<?php

use App\Modules\HoursOfService\Enums\DutyStatus;
use App\Modules\HoursOfService\Enums\ShiftStatus;
use App\Modules\HoursOfService\Models\OperatorDutyLog;
use App\Modules\HoursOfService\Models\OperatorShift;
use App\Platform\Identity\Models\User;
use App\Platform\Tracking\Models\LocationUpdate;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

it('prunes precise coordinates older than 30 days while preserving non-coordinate audit metadata', function () {
    $user = User::factory()->create();

    // Recent update (10 days old)
    $recent = LocationUpdate::query()->create([
        'user_id' => $user->id,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5,
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => now()->subDays(10),
        'received_at' => now()->subDays(10),
    ]);

    // Old update (35 days old)
    $old = LocationUpdate::query()->create([
        'user_id' => $user->id,
        'latitude' => 14.6010,
        'longitude' => 120.9850,
        'accuracy_metres' => 8,
        'source' => 'mobile',
        'sharing_enabled' => true,
        'captured_at' => now()->subDays(35),
        'received_at' => now()->subDays(35),
    ]);

    // Run pruning command
    $this->artisan('location:prune')->assertSuccessful();

    $recent->refresh();
    $old->refresh();

    // Recent coordinates are intact
    expect((float) $recent->latitude)->toBe(14.5995)
        ->and((float) $recent->longitude)->toBe(120.9842);

    // Old coordinates are pruned (set to null)
    expect($old->latitude)->toBeNull()
        ->and($old->longitude)->toBeNull();

    // Non-coordinate audit facts are preserved
    expect($old->user_id)->toBe($user->id)
        ->and($old->source)->toBe('mobile')
        ->and($old->sharing_enabled)->toBeTrue()
        ->and($old->captured_at->toIso8601String())->toBe(now()->subDays(35)->toIso8601String());
});

it('redacts old duty-event coordinates without deleting the accepted transition audit', function () {
    $user = User::factory()->create();
    $oldRecordedAt = now()->subDays(35);
    $shift = OperatorShift::query()->create([
        'user_id' => $user->id,
        'status' => ShiftStatus::COMPLETED,
        'started_at' => $oldRecordedAt,
        'ended_at' => $oldRecordedAt->copy()->addHour(),
    ]);
    $log = OperatorDutyLog::query()->create([
        'operator_shift_id' => $shift->id,
        'user_id' => $user->id,
        'duty_status' => DutyStatus::OPERATING,
        'started_at' => $oldRecordedAt,
        'ended_at' => $oldRecordedAt->copy()->addHour(),
        'duration_minutes' => 60,
        'occurred_at' => $oldRecordedAt,
        'accepted_at' => $oldRecordedAt,
        'latitude' => 14.5995,
        'longitude' => 120.9842,
        'accuracy_metres' => 5,
        'location_observed_at' => $oldRecordedAt,
        'location_source' => 'gps',
        'location_freshness' => 'fresh',
    ]);
    $delayed = OperatorDutyLog::query()->create([
        'operator_shift_id' => $shift->id,
        'user_id' => $user->id,
        'duty_status' => DutyStatus::DRIVING,
        'started_at' => now()->subDays(35)->addHours(1),
        'ended_at' => now()->subDays(35)->addHours(2),
        'duration_minutes' => 60,
        'occurred_at' => now()->subDays(35)->addHours(1),
        'accepted_at' => now()->subMinute(),
        'latitude' => 14.6010,
        'longitude' => 120.9850,
        'accuracy_metres' => 8,
        'location_observed_at' => now()->subDays(35)->addHours(1),
        'location_source' => 'last_known',
        'location_freshness' => 'last_known',
    ]);
    DB::table('operator_duty_logs')->where('id', $log->id)->update([
        'created_at' => $oldRecordedAt,
        'updated_at' => $oldRecordedAt,
    ]);

    $this->artisan('location:prune')->assertSuccessful();

    $log->refresh();
    $delayed->refresh();

    expect($log->latitude)->toBeNull()
        ->and($log->longitude)->toBeNull()
        ->and($log->accuracy_metres)->toBeNull()
        ->and($log->location_source)->toBe('retention_pruned')
        ->and($log->location_freshness)->toBe('unavailable')
        ->and($log->duty_status)->toBe(DutyStatus::OPERATING)
        ->and($log->duration_minutes)->toBe(60)
        ->and($log->occurred_at->toIso8601String())->toBe($oldRecordedAt->toIso8601String())
        ->and($log->accepted_at->toIso8601String())->toBe($oldRecordedAt->toIso8601String())
        ->and($delayed->latitude)->toBeNull()
        ->and($delayed->longitude)->toBeNull()
        ->and($delayed->location_source)->toBe('retention_pruned')
        ->and($delayed->location_freshness)->toBe('unavailable')
        ->and($delayed->accepted_at->isToday())->toBeTrue();
});
