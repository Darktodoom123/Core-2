<?php

namespace App\ViewModels;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Models\ApprovalRequest;
use App\Models\AuditEvent;
use App\Models\Client;
use App\Models\DispatchAssetAssignment;
use App\Models\DispatchJob;
use App\Models\DispatchPersonnelAssignment;
use App\Models\FuelLog;
use App\Models\FuelRequest;
use App\Models\GptRecommendation;
use App\Models\LocationUpdate;
use App\Models\OperationalAsset;
use App\Models\ServiceRequest;
use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Gate;

final class OperationsWorkspaceViewModel
{
    /**
     * @param  Collection<int, Client>  $clients
     * @return array<int, array<string, mixed>>
     */
    public static function clients(Collection $clients): array
    {
        return $clients->map(static fn (Client $client): array => [
            'id' => (int) $client->getKey(),
            'code' => $client->code,
            'company_name' => $client->company_name,
            'address' => $client->address,
        ])->values()->all();
    }

    /**
     * @param  Collection<int, ServiceRequest>  $requests
     * @return array<int, array<string, mixed>>
     */
    public static function serviceRequests(Collection $requests): array
    {
        return $requests->map(static fn (ServiceRequest $request): array => [
            'id' => (int) $request->getKey(),
            'reference' => $request->reference,
            'client' => [
                'id' => (int) $request->client->getKey(),
                'code' => $request->client->code,
                'company_name' => $request->client->company_name,
            ],
            'project_name' => $request->project_name,
            'service_type' => $request->service_type,
            'location' => $request->location,
            'site_notes' => $request->site_notes,
            'scheduled_date' => $request->scheduled_date?->toIso8601String(),
            'priority' => [
                'value' => $request->priority->value,
                'label' => $request->priority->label(),
            ],
            'status' => [
                'value' => $request->status->value,
                'label' => $request->status->label(),
            ],
            'requirements' => $request->requirements ?? [],
            'dispatch_jobs_count' => (int) $request->getAttribute('dispatch_jobs_count'),
        ])->values()->all();
    }

    /**
     * @param  Collection<int, DispatchJob>  $jobs
     * @return array<int, array<string, mixed>>
     */
    public static function jobs(Collection $jobs): array
    {
        return $jobs->map(static fn (DispatchJob $job): array => self::job($job))->values()->all();
    }

    /** @return array<string, mixed> */
    public static function job(DispatchJob $job): array
    {
        return [
            'id' => (int) $job->getKey(),
            'reference' => $job->reference,
            'client' => $job->client,
            'title' => $job->title,
            'site' => $job->site,
            'site_notes' => $job->site_notes,
            'priority' => [
                'value' => $job->priority->value,
                'label' => $job->priority->label(),
            ],
            'status' => [
                'value' => $job->status->value,
                'label' => $job->status->label(),
            ],
            'scheduled_start' => $job->scheduled_start?->toIso8601String(),
            'scheduled_end' => $job->scheduled_end?->toIso8601String(),
            'requirements' => $job->requirements ?? [],
            'version' => $job->version,
            'updated_at' => $job->updated_at?->toIso8601String(),
            'personnel_assignments' => $job->personnelAssignments
                ->map(static fn (DispatchPersonnelAssignment $assignment): array => [
                    'id' => (int) $assignment->getKey(),
                    'user_id' => (int) $assignment->user_id,
                    'name' => $assignment->user->name,
                    'type' => $assignment->assignment_type,
                    'response_status' => [
                        'value' => $assignment->response_status->value,
                        'label' => $assignment->response_status->label(),
                    ],
                    'responded_at' => $assignment->responded_at?->toIso8601String(),
                    'response_reason' => $assignment->response_reason,
                ])->values()->all(),
            'asset_assignments' => $job->assetAssignments
                ->map(static fn (DispatchAssetAssignment $assignment): array => [
                    'id' => (int) $assignment->getKey(),
                    'operational_asset_id' => (int) $assignment->operational_asset_id,
                    'code' => $assignment->asset->code,
                    'name' => $assignment->asset->name,
                    'type' => $assignment->assignment_type,
                ])->values()->all(),
        ];
    }

    /**
     * @param  Collection<int, OperationalAsset>  $assets
     * @return array<int, array<string, mixed>>
     */
    public static function assets(Collection $assets): array
    {
        return $assets->map(static function (OperationalAsset $asset): array {
            $blockingCount = (int) $asset->getAttribute('blocking_work_orders_count');
            $inspections = $asset->relationLoaded('inspections') ? $asset->inspections : collect();
            $maintenanceOrders = $asset->relationLoaded('maintenanceWorkOrders') ? $asset->maintenanceWorkOrders : collect();
            $hasPassingInspection = $inspections->contains(static fn ($i): bool => $i->result === 'passed' && $i->completed_at !== null);
            $isDispatchable = $asset->status->dispatchable() && $blockingCount === 0 && $hasPassingInspection;

            return [
                'id' => (int) $asset->getKey(),
                'code' => $asset->code,
                'name' => $asset->name,
                'kind' => $asset->kind,
                'subtype' => $asset->subtype,
                'registration_number' => $asset->registration_number,
                'manufacturer' => $asset->manufacturer,
                'model' => $asset->model,
                'rated_capacity' => $asset->rated_capacity,
                'capacity_unit' => $asset->capacity_unit,
                'meter_type' => $asset->meter_type,
                'meter_value' => $asset->meter_value,
                'location' => $asset->location,
                'specifications' => $asset->specifications ?? [],
                'status' => [
                    'value' => $asset->status->value,
                    'label' => $asset->status->label(),
                ],
                'blocking_work_orders_count' => $blockingCount,
                'is_dispatchable' => $isDispatchable,
                'inspections' => $inspections->map(static fn ($inspection): array => [
                    'id' => (int) $inspection->getKey(),
                    'type' => $inspection->type,
                    'result' => $inspection->result,
                    'checklist' => $inspection->checklist ?? [],
                    'findings' => $inspection->findings,
                    'completed_at' => $inspection->completed_at?->toIso8601String(),
                ])->values()->all(),
                'maintenance_work_orders' => $maintenanceOrders->map(static fn ($order): array => [
                    'id' => (int) $order->getKey(),
                    'defect' => $order->defect,
                    'status' => $order->status,
                    'dispatch_blocking' => (bool) $order->dispatch_blocking,
                    'scheduled_at' => $order->scheduled_at?->toIso8601String(),
                    'next_due_at' => $order->next_due_at?->toIso8601String(),
                    'work_performed' => $order->work_performed ?? [],
                    'parts' => $order->parts ?? [],
                    'released_at' => $order->released_at?->toIso8601String(),
                    'remarks' => $order->remarks,
                ])->values()->all(),
            ];
        })->values()->all();
    }

    /**
     * @param  Collection<int, FuelRequest>  $requests
     * @return array<int, array<string, mixed>>
     */
    public static function fuelRequests(Collection $requests): array
    {
        return $requests->map(static fn (FuelRequest $request): array => [
            'id' => (int) $request->getKey(),
            'reference' => $request->reference,
            'requester' => [
                'id' => (int) $request->requester->getKey(),
                'name' => $request->requester->name,
            ],
            'job' => $request->job === null ? null : [
                'id' => (int) $request->job->getKey(),
                'reference' => $request->job->reference,
                'title' => $request->job->title,
            ],
            'asset' => $request->asset === null ? null : [
                'id' => (int) $request->asset->getKey(),
                'code' => $request->asset->code,
                'name' => $request->asset->name,
            ],
            'quantity_litres' => (string) $request->quantity_litres,
            'fuel_type' => $request->fuel_type,
            'purpose' => $request->purpose,
            'status' => [
                'value' => $request->status->value,
                'label' => $request->status->label(),
            ],
            'decision_reason' => $request->decision_reason,
            'reviewed_at' => $request->reviewed_at?->toIso8601String(),
            'approved_at' => $request->approved_at?->toIso8601String(),
            'verified_at' => $request->verified_at?->toIso8601String(),
            'logs' => $request->relationLoaded('logs')
                ? $request->logs->map(static fn (FuelLog $log): array => [
                    'id' => (int) $log->getKey(),
                    'quantity_litres' => (string) $log->quantity_litres,
                    'odometer_km' => $log->odometer_km,
                    'hour_meter' => $log->hour_meter !== null ? (string) $log->hour_meter : null,
                    'price_per_litre' => $log->price_per_litre !== null ? (string) $log->price_per_litre : null,
                    'total_cost' => $log->total_cost !== null ? (string) $log->total_cost : null,
                    'fuel_station' => $log->fuel_station,
                    'remarks' => $log->remarks,
                    'receipt_path' => $log->receipt_path,
                    'recorded_by' => $log->relationLoaded('recorder') ? [
                        'id' => (int) $log->recorder->getKey(),
                        'name' => $log->recorder->name,
                    ] : null,
                    'recorded_at' => $log->recorded_at?->toIso8601String(),
                ])->values()->all()
                : [],
        ])->values()->all();
    }

    /**
     * @param  Collection<int, ApprovalRequest>  $approvals
     * @return array<int, array<string, mixed>>
     */
    public static function approvals(Collection $approvals, User $user): array
    {
        return $approvals->map(static function (ApprovalRequest $approval) use ($user): array {
            $subject = $approval->subject;
            $requestedChanges = $approval->requested_changes ?? [];
            $personnelByUserId = $subject instanceof DispatchJob
                ? $subject->personnelAssignments->keyBy('user_id')
                : collect();
            $personnelById = $subject instanceof DispatchJob
                ? $subject->personnelAssignments->keyBy('id')
                : collect();
            $assetByOperationalAssetId = $subject instanceof DispatchJob
                ? $subject->assetAssignments->keyBy('operational_asset_id')
                : collect();
            $assetById = $subject instanceof DispatchJob
                ? $subject->assetAssignments->keyBy('id')
                : collect();
            $canDecide = Gate::forUser($user)->allows('decide', $approval);

            return [
                'id' => (int) $approval->getKey(),
                'kind' => $approval->kind,
                'status' => [
                    'value' => $approval->status->value,
                    'label' => $approval->status->label(),
                ],
                'subject' => [
                    'id' => $approval->subject_id,
                    'reference' => $subject instanceof DispatchJob
                        ? $subject->reference
                        : class_basename($approval->subject_type).' #'.$approval->subject_id,
                    'title' => $subject instanceof DispatchJob ? $subject->title : null,
                    'site' => $subject instanceof DispatchJob ? $subject->site : null,
                    'site_notes' => $subject instanceof DispatchJob ? $subject->site_notes : null,
                    'scheduled_start' => $subject instanceof DispatchJob ? $subject->scheduled_start?->toIso8601String() : null,
                    'scheduled_end' => $subject instanceof DispatchJob ? $subject->scheduled_end?->toIso8601String() : null,
                    'priority' => $subject instanceof DispatchJob ? [
                        'value' => $subject->priority->value,
                        'label' => $subject->priority->label(),
                    ] : null,
                    'status' => $subject instanceof DispatchJob ? [
                        'value' => $subject->status->value,
                        'label' => $subject->status->label(),
                    ] : null,
                    'version' => $subject instanceof DispatchJob ? $subject->version : null,
                ],
                'requester' => [
                    'id' => $approval->requested_by,
                    'name' => $approval->requester->name,
                ],
                'requested_changes' => [
                    'personnel' => self::approvalPersonnelChanges($requestedChanges, $personnelByUserId),
                    'assets' => self::approvalAssetChanges($requestedChanges, $assetByOperationalAssetId),
                    'ended_personnel' => self::approvalEndedPersonnelChanges($requestedChanges, $personnelById),
                    'ended_assets' => self::approvalEndedAssetChanges($requestedChanges, $assetById),
                ],
                'can_decide' => $canDecide,
                'decision_blocker' => $canDecide
                    ? null
                    : ($approval->requested_by === $user->id
                        ? 'You requested this exceptional work. Another authorized manager must decide it.'
                        : 'Your role cannot decide this approval request.'),
                'created_at' => $approval->created_at?->toIso8601String(),
            ];
        })->values()->all();
    }

    /**
     * @param  Collection<int, User>  $users
     * @return array<int, array<string, mixed>>
     */
    public static function users(Collection $users): array
    {
        return $users->map(static fn (User $user): array => [
            'id' => (int) $user->getKey(),
            'name' => $user->name,
            'email' => $user->email,
            'is_active' => (bool) $user->is_active,
            'role' => $user->operationalRole()?->value,
            'role_label' => $user->operationalRole()?->label(),
        ])->values()->all();
    }

    /**
     * @param  Collection<int, AuditEvent>  $events
     * @return array<int, array<string, mixed>>
     */
    public static function auditEvents(Collection $events): array
    {
        return $events->map(static fn (AuditEvent $event): array => [
            'id' => (int) $event->getKey(),
            'action' => $event->action,
            'actor' => $event->actor === null ? null : [
                'id' => (int) $event->actor->getKey(),
                'name' => $event->actor->name,
            ],
            'occurred_at' => $event->occurred_at?->toIso8601String(),
            'reason' => $event->reason,
        ])->values()->all();
    }

    /**
     * @param  Collection<int, LocationUpdate>  $locations
     * @return array<int, array<string, mixed>>
     */
    public static function locations(Collection $locations): array
    {
        return $locations->map(static fn (LocationUpdate $location): array => [
            'id' => (int) $location->getKey(),
            'user' => [
                'id' => (int) $location->user->getKey(),
                'name' => $location->user->name,
            ],
            'asset' => $location->asset === null ? null : [
                'id' => (int) $location->asset->getKey(),
                'code' => $location->asset->code,
                'name' => $location->asset->name,
            ],
            'job' => $location->job === null ? null : [
                'id' => (int) $location->job->getKey(),
                'reference' => $location->job->reference,
                'title' => $location->job->title,
            ],
            'latitude' => $location->latitude !== null ? (float) $location->latitude : null,
            'longitude' => $location->longitude !== null ? (float) $location->longitude : null,
            'accuracy_metres' => $location->accuracy_metres !== null ? (float) $location->accuracy_metres : null,
            'speed' => $location->speed !== null ? (float) $location->speed : null,
            'remarks' => $location->remarks,
            'source' => $location->source,
            'sharing_enabled' => (bool) $location->sharing_enabled,
            'captured_at' => $location->captured_at?->toIso8601String(),
            'received_at' => $location->received_at?->toIso8601String(),
            'freshness_status' => $location->freshness_status,
        ])->values()->all();
    }

    /** @return array<int, array{id: string, label: string}> */
    public static function navigation(User $user): array
    {
        $fieldRole = in_array($user->operationalRole(), [
            RoleName::Driver,
            RoleName::CraneOperator,
            RoleName::FieldTechnician,
        ], true);

        $items = [
            [
                'id' => 'dispatch',
                'label' => $fieldRole ? "Today's work" : 'Dispatch workspace',
                'permissions' => [
                    PermissionName::DispatchViewAll,
                    PermissionName::DispatchViewAssigned,
                ],
            ],
            [
                'id' => 'assets',
                'label' => $fieldRole ? self::fieldAssetLabel($user) : 'Fleet & equipment',
                'permissions' => [
                    PermissionName::FleetViewAll,
                    PermissionName::FleetViewAssigned,
                    PermissionName::EquipmentViewAll,
                    PermissionName::EquipmentViewAssigned,
                ],
            ],
            [
                'id' => 'fuel',
                'label' => 'Fuel requests',
                'permissions' => [
                    PermissionName::FuelViewAll,
                    PermissionName::FuelViewOwn,
                    PermissionName::FuelRequest,
                ],
            ],
            [
                'id' => 'tracking',
                'label' => 'Live tracking',
                'permissions' => [
                    PermissionName::TrackingViewAll,
                    PermissionName::TrackingShareOwn,
                ],
            ],
            [
                'id' => 'approvals',
                'label' => 'Approvals',
                'permissions' => [
                    PermissionName::AssignmentsApprove,
                    PermissionName::DispatchApprovePriority,
                ],
            ],
            [
                'id' => 'users',
                'label' => 'Users & roles',
                'permissions' => [PermissionName::UsersManage],
            ],
            [
                'id' => 'audit',
                'label' => 'Audit trail',
                'permissions' => [PermissionName::AuditView],
            ],
        ];

        return collect($items)
            ->filter(static fn (array $item): bool => collect($item['permissions'])
                ->contains(static fn (PermissionName $permission): bool => $user->can($permission->value)))
            ->map(static fn (array $item): array => [
                'id' => $item['id'],
                'label' => $item['label'],
            ])->values()->all();
    }

    /** @return array<string, bool> */
    public static function capabilities(User $user): array
    {
        return [
            'create_dispatch' => $user->can(PermissionName::DispatchCreate->value),
            'create_client' => $user->can(PermissionName::DispatchCreate->value),
            'create_service_request' => $user->can(PermissionName::DispatchCreate->value),
            'convert_service_request' => $user->can(PermissionName::DispatchCreate->value),
            'share_location' => $user->can(PermissionName::TrackingShareOwn->value),
            'view_tracking' => $user->can(PermissionName::TrackingViewAll->value) || $user->can(PermissionName::TrackingShareOwn->value),
            'request_fuel' => $user->can(PermissionName::FuelRequest->value),
            'forward_fuel' => $user->can(PermissionName::FuelForward->value),
            'approve_fuel' => $user->can(PermissionName::FuelApprove->value),
            'verify_fuel' => $user->can(PermissionName::FuelVerify->value),
            'record_fuel' => $user->can(PermissionName::FuelRecord->value),
            'decide_approval' => $user->can(PermissionName::AssignmentsApprove->value)
                || $user->can(PermissionName::DispatchApprovePriority->value),
            'update_assigned_dispatch_status' => $user->can(PermissionName::DispatchUpdateOwnStatus->value),
            'register_asset' => $user->can(PermissionName::FleetRegister->value) || $user->can(PermissionName::EquipmentRegister->value),
            'update_asset_status' => $user->can(PermissionName::FleetUpdateStatus->value) || $user->can(PermissionName::EquipmentUpdateStatus->value),
            'inspect_asset' => $user->can(PermissionName::FleetInspect->value) || $user->can(PermissionName::EquipmentInspect->value),
            'maintain_asset' => $user->can(PermissionName::FleetMaintain->value) || $user->can(PermissionName::EquipmentMaintain->value),
            'request_gpt_assistance' => $user->can(PermissionName::GptUseDispatch->value) || $user->can(PermissionName::GptUseOperations->value) || $user->can(PermissionName::GptUseMaintenance->value),
            'decide_gpt_recommendation' => $user->can(PermissionName::GptUseDispatch->value) || $user->can(PermissionName::GptUseOperations->value),
        ];
    }

    /**
     * @param  Collection<int, GptRecommendation>  $recommendations
     * @return array<int, array<string, mixed>>
     */
    public static function gptRecommendations(Collection $recommendations): array
    {
        return $recommendations->map(static fn (GptRecommendation $rec): array => [
            'id' => (int) $rec->getKey(),
            'subject_type' => $rec->subject_type,
            'subject_id' => $rec->subject_id,
            'purpose' => $rec->purpose,
            'context_hash' => $rec->context_hash,
            'status' => $rec->status,
            'prompt_summary' => $rec->prompt_summary,
            'response_summary' => $rec->response_summary,
            'recommendation' => $rec->recommendation ?? [],
            'conflicts' => $rec->conflicts ?? [],
            'model' => $rec->model,
            'cost_usd' => $rec->cost_usd !== null ? (float) $rec->cost_usd : null,
            'expires_at' => $rec->expires_at instanceof Carbon ? $rec->expires_at->toIso8601String() : null,
            'is_expired' => $rec->isExpired(),
            'error_message' => $rec->error_message,
            'requested_by' => [
                'id' => (int) $rec->requestedBy->getKey(),
                'name' => $rec->requestedBy->name,
            ],
            'decided_by' => $rec->decidedBy === null ? null : [
                'id' => (int) $rec->decidedBy->getKey(),
                'name' => $rec->decidedBy->name,
            ],
            'decided_at' => $rec->decided_at instanceof Carbon ? $rec->decided_at->toIso8601String() : null,
            'created_at' => $rec->created_at instanceof Carbon ? $rec->created_at->toIso8601String() : null,
            'is_advisory' => true,
        ])->values()->all();
    }

    private static function fieldAssetLabel(User $user): string
    {
        return match ($user->operationalRole()) {
            RoleName::CraneOperator => 'Assigned equipment',
            RoleName::FieldTechnician => 'Service assets',
            default => 'Assigned vehicle',
        };
    }

    /**
     * @param  array<string, mixed>  $requestedChanges
     * @param  Collection<int, DispatchPersonnelAssignment>  $assignments
     * @return list<array{id: int, name: string, assignment_type: string}>
     */
    private static function approvalPersonnelChanges(array $requestedChanges, Collection $assignments): array
    {
        $changes = $requestedChanges['personnel'] ?? [];
        if ($changes === []) {
            $changes = $requestedChanges['new_personnel'] ?? [];
        }
        if (! is_array($changes)) {
            return [];
        }

        $result = [];
        foreach ($changes as $change) {
            if (! is_array($change)
                || ! is_int($change['user_id'] ?? null)
                || ! is_string($change['assignment_type'] ?? null)) {
                continue;
            }

            $userId = $change['user_id'];
            $assignment = $assignments->get($userId);
            $result[] = [
                'id' => $userId,
                'name' => $assignment === null ? "User #{$userId}" : $assignment->user->name,
                'assignment_type' => $change['assignment_type'],
            ];
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $requestedChanges
     * @param  Collection<int, DispatchAssetAssignment>  $assignments
     * @return list<array{id: int, code: string, name: string, assignment_type: string}>
     */
    private static function approvalAssetChanges(array $requestedChanges, Collection $assignments): array
    {
        $changes = $requestedChanges['assets'] ?? [];
        if ($changes === []) {
            $changes = $requestedChanges['new_assets'] ?? [];
        }
        if (! is_array($changes)) {
            return [];
        }

        $result = [];
        foreach ($changes as $change) {
            if (! is_array($change)
                || ! is_int($change['operational_asset_id'] ?? null)
                || ! is_string($change['assignment_type'] ?? null)) {
                continue;
            }

            $assetId = $change['operational_asset_id'];
            $assignment = $assignments->get($assetId);
            $result[] = [
                'id' => $assetId,
                'code' => $assignment === null ? "Asset #{$assetId}" : $assignment->asset->code,
                'name' => $assignment === null ? 'Unavailable asset' : $assignment->asset->name,
                'assignment_type' => $change['assignment_type'],
            ];
        }

        return $result;
    }

    /**
     * @param  array<string, mixed>  $requestedChanges
     * @param  Collection<int, DispatchPersonnelAssignment>  $assignments
     * @return list<array{id: int, name: string, assignment_type: string}>
     */
    private static function approvalEndedPersonnelChanges(array $requestedChanges, Collection $assignments): array
    {
        $ids = $requestedChanges['end_personnel_ids'] ?? [];
        if (! is_array($ids)) {
            return [];
        }

        return array_values(collect($ids)
            ->filter(static fn (mixed $id): bool => is_int($id))
            ->map(static function (int $id) use ($assignments): array {
                $assignment = $assignments->get($id);

                return [
                    'id' => $id,
                    'name' => $assignment === null ? "Assignment #{$id}" : $assignment->user->name,
                    'assignment_type' => $assignment === null ? 'personnel' : $assignment->assignment_type,
                ];
            })->all());
    }

    /**
     * @param  array<string, mixed>  $requestedChanges
     * @param  Collection<int, DispatchAssetAssignment>  $assignments
     * @return list<array{id: int, code: string, name: string, assignment_type: string}>
     */
    private static function approvalEndedAssetChanges(array $requestedChanges, Collection $assignments): array
    {
        $ids = $requestedChanges['end_asset_ids'] ?? [];
        if (! is_array($ids)) {
            return [];
        }

        return array_values(collect($ids)
            ->filter(static fn (mixed $id): bool => is_int($id))
            ->map(static function (int $id) use ($assignments): array {
                $assignment = $assignments->get($id);

                return [
                    'id' => $id,
                    'code' => $assignment === null ? "Assignment #{$id}" : $assignment->asset->code,
                    'name' => $assignment === null ? 'Unavailable asset' : $assignment->asset->name,
                    'assignment_type' => $assignment === null ? 'asset' : $assignment->assignment_type,
                ];
            })->all());
    }
}
