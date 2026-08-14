<?php

use App\Modules\Dispatch\Enums\DispatchStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

it('characterizes the legacy dispatch persistence contract before the V2 foundation', function (): void {
    expect(Schema::hasTable('dispatch_jobs'))->toBeTrue()
        ->and(Schema::hasTable('dispatch_personnel_assignments'))->toBeTrue()
        ->and(Schema::hasTable('dispatch_asset_assignments'))->toBeTrue()
        ->and(Schema::hasTable('approval_requests'))->toBeTrue()
        ->and(Schema::hasTable('audit_events'))->toBeTrue()
        ->and(Schema::hasTable('command_logs'))->toBeTrue();

    foreach (['service_request_id', 'source_type', 'source_id', 'source_reference', 'version', 'deleted_at'] as $column) {
        expect(Schema::hasColumn('dispatch_jobs', $column))->toBeTrue("Missing legacy dispatch_jobs.{$column} column.");
    }

    expect(Schema::hasColumn('dispatch_personnel_assignments', 'response_status'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_personnel_assignments', 'responded_at'))->toBeTrue()
        ->and(Schema::hasColumn('dispatch_personnel_assignments', 'active_until'))->toBeTrue()
        ->and(Schema::hasColumn('sales_orders', 'reference'))->toBeTrue()
        ->and(DispatchStatus::Accepted->value)->toBe('accepted');
});

it('has no server-side mobile outbox table in the legacy schema', function (): void {
    expect(Schema::hasTable('mobile_command_outbox'))->toBeFalse()
        ->and(Schema::hasTable('command_outbox'))->toBeFalse();
});
