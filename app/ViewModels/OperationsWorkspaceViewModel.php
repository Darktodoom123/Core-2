<?php

namespace App\ViewModels;

use App\Enums\PermissionName;
use App\Enums\RoleName;
use App\Models\ApprovalRequest;
use App\Models\AuditEvent;
use App\Models\DispatchJob;
use App\Models\FuelRequest;
use App\Models\OperationalAsset;
use App\Models\User;
use Illuminate\Support\Collection;

final class OperationsWorkspaceViewModel
{
    /**
     * @param  Collection<int, DispatchJob>  $jobs
     * @return array<int, array<string, mixed>>
     */
    public static function jobs(Collection $jobs): array
    {
        return $jobs->map(static fn (DispatchJob $job): array => [
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
            'version' => $job->version,
            'updated_at' => $job->updated_at?->toIso8601String(),
            'personnel_assignments' => $job->personnelAssignments
                ->map(static fn ($assignment): array => [
                    'id' => (int) $assignment->getKey(),
                    'name' => $assignment->user->name,
                    'type' => $assignment->assignment_type,
                ])->values()->all(),
            'asset_assignments' => $job->assetAssignments
                ->map(static fn ($assignment): array => [
                    'id' => (int) $assignment->getKey(),
                    'code' => $assignment->asset->code,
                    'name' => $assignment->asset->name,
                    'type' => $assignment->assignment_type,
                ])->values()->all(),
        ])->values()->all();
    }

    /**
     * @param  Collection<int, OperationalAsset>  $assets
     * @return array<int, array<string, mixed>>
     */
    public static function assets(Collection $assets): array
    {
        return $assets->map(static fn (OperationalAsset $asset): array => [
            'id' => (int) $asset->getKey(),
            'code' => $asset->code,
            'name' => $asset->name,
            'kind' => $asset->kind,
            'location' => $asset->location,
            'status' => [
                'value' => $asset->status->value,
                'label' => $asset->status->label(),
            ],
            'blocking_work_orders_count' => (int) $asset->getAttribute('blocking_work_orders_count'),
        ])->values()->all();
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
            'asset' => $request->asset === null ? null : [
                'id' => (int) $request->asset->getKey(),
                'code' => $request->asset->code,
            ],
            'quantity_litres' => (string) $request->quantity_litres,
            'fuel_type' => $request->fuel_type,
            'purpose' => $request->purpose,
            'status' => [
                'value' => $request->status->value,
                'label' => $request->status->label(),
            ],
        ])->values()->all();
    }

    /**
     * @param  Collection<int, ApprovalRequest>  $approvals
     * @return array<int, array<string, mixed>>
     */
    public static function approvals(Collection $approvals): array
    {
        return $approvals->map(static function (ApprovalRequest $approval): array {
            $subject = $approval->subject;

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
                ],
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
            'share_location' => $user->can(PermissionName::TrackingShareOwn->value),
            'request_fuel' => $user->can(PermissionName::FuelRequest->value),
            'forward_fuel' => $user->can(PermissionName::FuelForward->value),
            'approve_fuel' => $user->can(PermissionName::FuelApprove->value),
            'verify_fuel' => $user->can(PermissionName::FuelVerify->value),
            'decide_approval' => $user->can(PermissionName::AssignmentsApprove->value)
                || $user->can(PermissionName::DispatchApprovePriority->value),
        ];
    }

    private static function fieldAssetLabel(User $user): string
    {
        return match ($user->operationalRole()) {
            RoleName::CraneOperator => 'Assigned equipment',
            RoleName::FieldTechnician => 'Service assets',
            default => 'Assigned vehicle',
        };
    }
}
