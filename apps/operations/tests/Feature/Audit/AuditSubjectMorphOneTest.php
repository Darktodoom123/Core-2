<?php

use App\Platform\Audit\Models\AuditEvent;
use App\Shared\Assets\Enums\AssetStatus;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

function createStatusAuditedAsset(string $code): OperationalAsset
{
    $asset = OperationalAsset::query()->create([
        'code' => $code,
        'name' => 'Audited Asset '.$code,
        'kind' => 'mobile_crane',
        'status' => AssetStatus::Available,
    ]);

    AuditEvent::query()->create([
        'subject_type' => $asset->getMorphClass(),
        'subject_id' => (string) $asset->id,
        'action' => 'asset.status_updated',
        'before' => ['status' => AssetStatus::UnderInspection->value],
        'after' => ['status' => AssetStatus::Available->value],
        'occurred_at' => now()->subMinute(),
    ]);

    return $asset;
}

/**
 * audit_events.subject_id is VARCHAR; PostgreSQL rejects `varchar = integer`,
 * so the relation must never compare it against raw or integer-bound keys.
 *
 * @return list<array{query: string, bindings: array<array-key, mixed>, time: float|null}>
 */
function auditEventQueries(): array
{
    return array_values(array_filter(
        DB::getQueryLog(),
        static fn (array $entry): bool => str_contains($entry['query'], 'audit_events'),
    ));
}

it('eager loads the latest status change with string-bound subject keys', function (): void {
    $first = createStatusAuditedAsset('CRN-AUD-01');
    $second = createStatusAuditedAsset('CRN-AUD-02');

    DB::enableQueryLog();
    $assets = OperationalAsset::query()->with('latestStatusChange')->orderBy('id')->get();
    $queries = auditEventQueries();

    expect($assets->pluck('latestStatusChange.subject_id')->all())
        ->toBe([(string) $first->id, (string) $second->id])
        ->and($queries)->not->toBeEmpty();

    foreach ($queries as $entry) {
        expect($entry['query'])->not->toMatch('/"subject_id" in \(\d/');

        foreach ($entry['bindings'] as $binding) {
            expect($binding)->toBeString();
        }
    }
});

it('lazy loads the latest status change with a string-bound subject key', function (): void {
    $asset = createStatusAuditedAsset('CRN-AUD-03');

    DB::enableQueryLog();
    $statusChange = $asset->fresh()->latestStatusChange;

    expect($statusChange?->subject_id)->toBe((string) $asset->id);

    foreach (auditEventQueries() as $entry) {
        foreach ($entry['bindings'] as $binding) {
            expect($binding)->toBeString();
        }
    }
});
