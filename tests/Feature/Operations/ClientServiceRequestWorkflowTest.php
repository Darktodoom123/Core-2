<?php

use App\Actions\RecordAuditEvent;
use App\Enums\DispatchPriority;
use App\Enums\RoleName;
use App\Models\AuditEvent;
use App\Models\Client;
use App\Models\DispatchJob;
use App\Models\ServiceRequest;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;

uses(RefreshDatabase::class);

beforeEach(function (): void {
    $this->seed(RolePermissionSeeder::class);
});

function intakeUser(RoleName $role): User
{
    $user = User::factory()->create();
    $user->syncRoles([$role->value]);

    return $user;
}

it('lets an authorized dispatcher create a client and service request through the browser contract', function () {
    $dispatcher = intakeUser(RoleName::Dispatcher);

    $this->actingAs($dispatcher)
        ->from('/')
        ->post('/operations/clients', [
            'code' => 'CLI-4001',
            'company_name' => 'Arcwell Construction',
            'contact_person' => 'Ana Reyes',
            'phone' => '+63 900 000 0000',
            'email' => 'ana@example.com',
            'address' => 'Quezon City',
        ])
        ->assertRedirect('/')
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => 'Client Arcwell Construction was created.',
        ]);

    $client = Client::query()->where('code', 'CLI-4001')->sole();
    $scheduledDate = now()->addDays(2)->startOfHour();

    $this->actingAs($dispatcher)
        ->from('/')
        ->post('/operations/service-requests', [
            'reference' => 'SR-4001',
            'client_id' => $client->id,
            'project_name' => 'Plant lift',
            'service_type' => 'crane_and_truck',
            'location' => 'Pasig City',
            'site_notes' => 'Coordinate with the plant safety officer.',
            'scheduled_date' => $scheduledDate->toIso8601String(),
            'priority' => DispatchPriority::Priority->value,
            'requirements' => ['25t crane', 'flatbed truck'],
        ])
        ->assertRedirect('/')
        ->assertSessionHas('flash', [
            'tone' => 'success',
            'message' => 'Service request SR-4001 was recorded.',
        ]);

    $serviceRequest = ServiceRequest::query()->where('reference', 'SR-4001')->sole();

    expect($serviceRequest->client_id)->toBe($client->id)
        ->and($serviceRequest->created_by)->toBe($dispatcher->id)
        ->and($serviceRequest->status->value)->toBe('submitted')
        ->and($serviceRequest->scheduled_date?->equalTo($scheduledDate))->toBeTrue()
        ->and($serviceRequest->requirements)->toBe(['25t crane', 'flatbed truck'])
        ->and(AuditEvent::query()->where('actor_id', $dispatcher->id)->where('action', 'client.created')->count())->toBe(1)
        ->and(AuditEvent::query()->where('actor_id', $dispatcher->id)->where('action', 'service_request.created')->count())->toBe(1);
});

it('converts one service request into multiple distinct draft dispatches atomically and derives request-owned fields', function () {
    $dispatcher = intakeUser(RoleName::Dispatcher);
    $client = Client::query()->create([
        'code' => 'CLI-4002',
        'company_name' => 'Northline Logistics',
        'status' => 'active',
    ]);
    $serviceRequest = ServiceRequest::query()->create([
        'reference' => 'SR-4002',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'project_name' => 'Staged warehouse move',
        'service_type' => 'haulage',
        'location' => 'Makati City',
        'site_notes' => 'Use the loading entrance.',
        'scheduled_date' => now()->addDays(3),
        'priority' => DispatchPriority::Emergency,
        'status' => 'submitted',
        'requirements' => ['two trucks', 'driver credential'],
    ]);

    foreach ([
        ['reference' => 'DSP-4002-A', 'start' => now()->addDays(3), 'end' => now()->addDays(3)->addHours(4)],
        ['reference' => 'DSP-4002-B', 'start' => now()->addDays(4), 'end' => now()->addDays(4)->addHours(3)],
    ] as $conversion) {
        $this->actingAs($dispatcher)
            ->from('/')
            ->post('/operations/dispatch-jobs', [
                'service_request_id' => $serviceRequest->id,
                'reference' => $conversion['reference'],
                'scheduled_start' => $conversion['start']->toIso8601String(),
                'scheduled_end' => $conversion['end']->toIso8601String(),
            ])
            ->assertRedirect('/')
            ->assertSessionDoesntHaveErrors();
    }

    $jobs = DispatchJob::query()->whereBelongsTo($serviceRequest)->orderBy('reference')->get();

    expect($jobs)->toHaveCount(2)
        ->and($jobs->pluck('reference')->all())->toBe(['DSP-4002-A', 'DSP-4002-B'])
        ->and($jobs->every(fn (DispatchJob $job): bool => $job->client === 'Northline Logistics'))->toBeTrue()
        ->and($jobs->every(fn (DispatchJob $job): bool => $job->title === 'Staged warehouse move'))->toBeTrue()
        ->and($jobs->every(fn (DispatchJob $job): bool => $job->site === 'Makati City'))->toBeTrue()
        ->and($jobs->every(fn (DispatchJob $job): bool => $job->priority === DispatchPriority::Emergency))->toBeTrue()
        ->and($jobs->every(fn (DispatchJob $job): bool => $job->requirements === ['two trucks', 'driver credential']))->toBeTrue()
        ->and($jobs->every(fn (DispatchJob $job): bool => $job->status->value === 'draft' && $job->version === 1))->toBeTrue()
        ->and($serviceRequest->refresh()->status->value)->toBe('dispatching')
        ->and(AuditEvent::query()->where('action', 'dispatch.created')->count())->toBe(2)
        ->and(AuditEvent::query()->where('action', 'service_request.dispatch_started')->count())->toBe(1);
});

it('rejects duplicate and invalid service request conversions without creating another job', function () {
    $dispatcher = intakeUser(RoleName::Dispatcher);
    $client = Client::query()->create([
        'code' => 'CLI-4003',
        'company_name' => 'Apex Services',
        'status' => 'active',
    ]);
    $serviceRequest = ServiceRequest::query()->create([
        'reference' => 'SR-4003',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'project_name' => 'Routine lift',
        'service_type' => 'crane',
        'location' => 'Taguig City',
        'priority' => DispatchPriority::Routine,
        'status' => 'submitted',
    ]);
    $payload = [
        'service_request_id' => $serviceRequest->id,
        'reference' => 'DSP-4003',
        'scheduled_start' => now()->addDay()->toIso8601String(),
        'scheduled_end' => now()->addDay()->addHours(2)->toIso8601String(),
    ];

    $this->actingAs($dispatcher)
        ->from('/')
        ->post('/operations/dispatch-jobs', [
            ...$payload,
            'client' => 'Untrusted override',
            'title' => 'Untrusted override',
            'site' => 'Untrusted override',
            'priority' => DispatchPriority::Emergency->value,
            'requirements' => ['Untrusted override'],
        ])
        ->assertRedirect('/')
        ->assertSessionHasErrors(['client', 'title', 'site', 'priority', 'requirements']);

    $this->actingAs($dispatcher)->post('/operations/dispatch-jobs', $payload)->assertRedirect('/');

    $this->actingAs($dispatcher)
        ->from('/')
        ->post('/operations/dispatch-jobs', $payload)
        ->assertRedirect('/')
        ->assertSessionHasErrors('reference');

    DB::table('service_requests')
        ->where('id', $serviceRequest->id)
        ->update(['status' => 'cancelled']);

    $this->actingAs($dispatcher)
        ->from('/')
        ->post('/operations/dispatch-jobs', [
            ...$payload,
            'reference' => 'DSP-4003-B',
        ])
        ->assertRedirect('/')
        ->assertSessionHasErrors('service_request_id');

    expect(DispatchJob::query()->whereBelongsTo($serviceRequest)->count())->toBe(1);
});

it('rolls back the dispatch, request state, and audit history when conversion auditing fails', function () {
    $dispatcher = intakeUser(RoleName::Dispatcher);
    $client = Client::query()->create([
        'code' => 'CLI-4004',
        'company_name' => 'Safe Harbor',
        'status' => 'active',
    ]);
    $serviceRequest = ServiceRequest::query()->create([
        'reference' => 'SR-4004',
        'client_id' => $client->id,
        'created_by' => $dispatcher->id,
        'project_name' => 'Rollback lift',
        'service_type' => 'crane',
        'location' => 'Manila',
        'priority' => DispatchPriority::Routine,
        'status' => 'submitted',
    ]);
    $audit = Mockery::mock(RecordAuditEvent::class);
    $audit->shouldReceive('handle')->once()->andThrow(new RuntimeException('Audit storage unavailable.'));
    $this->app->instance(RecordAuditEvent::class, $audit);

    expect(fn () => $this->actingAs($dispatcher)
        ->withoutExceptionHandling()
        ->post('/operations/dispatch-jobs', [
            'service_request_id' => $serviceRequest->id,
            'reference' => 'DSP-4004',
            'scheduled_start' => now()->addDay()->toIso8601String(),
            'scheduled_end' => now()->addDay()->addHours(2)->toIso8601String(),
        ]))->toThrow(RuntimeException::class, 'Audit storage unavailable.');

    expect(DispatchJob::query()->where('reference', 'DSP-4004')->exists())->toBeFalse()
        ->and($serviceRequest->refresh()->status->value)->toBe('submitted')
        ->and(AuditEvent::query()->count())->toBe(0);
});

it('validates intake boundaries and only accepts active clients', function () {
    $dispatcher = intakeUser(RoleName::Dispatcher);
    $inactiveClient = Client::query()->create([
        'code' => 'CLI-4005',
        'company_name' => 'Inactive Client',
        'status' => 'inactive',
    ]);

    $this->actingAs($dispatcher)
        ->from('/')
        ->post('/operations/clients', [
            'code' => '',
            'company_name' => '',
            'email' => 'not-an-email',
        ])
        ->assertRedirect('/')
        ->assertSessionHasErrors(['code', 'company_name', 'email']);

    $this->actingAs($dispatcher)
        ->from('/')
        ->post('/operations/service-requests', [
            'reference' => '',
            'client_id' => $inactiveClient->id,
            'project_name' => '',
            'service_type' => '',
            'location' => '',
            'scheduled_date' => 'not-a-date',
            'priority' => 'urgent',
            'requirements' => [str_repeat('x', 256)],
            'site_notes' => str_repeat('x', 5001),
        ])
        ->assertRedirect('/')
        ->assertSessionHasErrors([
            'reference',
            'client_id',
            'project_name',
            'service_type',
            'location',
            'scheduled_date',
            'priority',
            'requirements.0',
            'site_notes',
        ]);

    expect(Client::query()->count())->toBe(1)
        ->and(ServiceRequest::query()->count())->toBe(0);
});

it('forbids client, service request, and linked dispatch creation without dispatch create permission', function (string $path, array $payload) {
    $driver = intakeUser(RoleName::Driver);

    $this->actingAs($driver)->post($path, $payload)->assertForbidden();

    expect(Client::query()->count())->toBe(0)
        ->and(ServiceRequest::query()->count())->toBe(0)
        ->and(DispatchJob::query()->count())->toBe(0);
})->with([
    'client creation' => ['/operations/clients', ['code' => 'CLI-X', 'company_name' => 'Forbidden']],
    'service request creation' => ['/operations/service-requests', [
        'reference' => 'SR-X',
        'client_id' => 1,
        'project_name' => 'Forbidden',
        'service_type' => 'crane',
        'location' => 'Manila',
        'priority' => 'routine',
    ]],
    'request conversion' => ['/operations/dispatch-jobs', [
        'service_request_id' => 1,
        'reference' => 'DSP-X',
        'scheduled_start' => '2026-08-01T08:00:00+08:00',
        'scheduled_end' => '2026-08-01T10:00:00+08:00',
    ]],
]);
