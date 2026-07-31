<?php

use App\Events\WorkspaceUpdated;
use Illuminate\Support\Facades\Event;

test('workspace updated event broadcasts on private operations workspace channel', function () {
    Event::fake();

    WorkspaceUpdated::dispatch('dispatch', 'updated');

    Event::assertDispatched(WorkspaceUpdated::class, function ($event) {
        return $event->resourceType === 'dispatch'
            && $event->action === 'updated'
            && count($event->broadcastOn()) === 1
            && $event->broadcastOn()[0]->name === 'private-operations.workspace';
    });
});

test('workspace updated event returns correct broadcast payload', function () {
    $event = new WorkspaceUpdated('asset', 'created', '2026-07-31T12:00:00Z');

    expect($event->broadcastAs())->toBe('WorkspaceUpdated');
    expect($event->broadcastWith())->toBe([
        'resource_type' => 'asset',
        'action' => 'created',
        'timestamp' => '2026-07-31T12:00:00Z',
    ]);
});
