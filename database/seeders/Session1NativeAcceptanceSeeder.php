<?php

namespace Database\Seeders;

use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Enums\DispatchPriority;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use LogicException;

final class Session1NativeAcceptanceSeeder extends Seeder
{
    public const ASSIGNED_JOB_REFERENCE = 'SESSION1-DRIVER-001';

    public const FORBIDDEN_JOB_REFERENCE = 'SESSION1-FORBIDDEN-002';

    public function run(): void
    {
        $database = (string) config('database.connections.sqlite.database');

        if (
            config('database.default') !== 'sqlite'
            || basename($database) !== 'session1-native.sqlite'
        ) {
            throw new LogicException(
                'Session 1 native fixtures may only seed the dedicated session1-native.sqlite database.',
            );
        }

        $this->call([
            RolePermissionSeeder::class,
            LocalDevelopmentSeeder::class,
        ]);

        $dispatcher = User::query()->where('email', 'dispatcher@example.com')->firstOrFail();
        $driver = User::query()->where('email', 'driver@example.com')->firstOrFail();
        $operator = User::query()->where('email', 'operator@example.com')->firstOrFail();
        $fixturePassword = getenv('SESSION1_NATIVE_PASSWORD');

        if (! is_string($fixturePassword) || strlen($fixturePassword) < 24) {
            throw new LogicException(
                'SESSION1_NATIVE_PASSWORD must contain a process-only value of at least 24 characters.',
            );
        }

        foreach ([$dispatcher, $driver, $operator] as $user) {
            $user->forceFill(['password' => Hash::make($fixturePassword)])->save();
        }

        $assignedJob = DispatchJob::query()->updateOrCreate(
            ['reference' => self::ASSIGNED_JOB_REFERENCE],
            [
                'client' => 'Session 1 Local Client',
                'title' => 'Driver native acceptance assignment',
                'site' => 'Local Android Test Site',
                'priority' => DispatchPriority::Routine,
                'status' => DispatchStatus::Dispatched,
                'version' => 1,
                'created_by' => $dispatcher->id,
            ],
        );

        $forbiddenJob = DispatchJob::query()->updateOrCreate(
            ['reference' => self::FORBIDDEN_JOB_REFERENCE],
            [
                'client' => 'Session 1 Isolated Client',
                'title' => 'Other worker assignment',
                'site' => 'Forbidden Local Test Site',
                'priority' => DispatchPriority::Routine,
                'status' => DispatchStatus::Dispatched,
                'version' => 1,
                'created_by' => $dispatcher->id,
            ],
        );

        DispatchPersonnelAssignment::query()->updateOrCreate(
            [
                'dispatch_job_id' => $assignedJob->id,
                'user_id' => $driver->id,
            ],
            [
                'assignment_type' => 'driver',
                'assigned_by' => $dispatcher->id,
                'response_status' => AssignmentResponse::Pending,
                'active_from' => now()->subMinute(),
                'active_until' => null,
            ],
        );

        DispatchPersonnelAssignment::query()->updateOrCreate(
            [
                'dispatch_job_id' => $forbiddenJob->id,
                'user_id' => $operator->id,
            ],
            [
                'assignment_type' => 'crane_operator',
                'assigned_by' => $dispatcher->id,
                'response_status' => AssignmentResponse::Pending,
                'active_from' => now()->subMinute(),
                'active_until' => null,
            ],
        );
    }
}
