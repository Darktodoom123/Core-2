<?php

namespace App\Modules\Dispatch\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Assignment\Actions\RespondToDispatchAssignment;
use App\Modules\Assignment\Enums\AssignmentResponse;
use App\Modules\Assignment\Http\Requests\RespondToDispatchAssignmentRequest;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Actions\TransitionDispatchJob;
use App\Modules\Dispatch\Commands\DispatchV2Commands;
use App\Modules\Dispatch\Data\DispatchV2Mutation;
use App\Modules\Dispatch\Enums\DelayContext;
use App\Modules\Dispatch\Enums\DispatchAssignmentOfferStatus;
use App\Modules\Dispatch\Enums\DispatchAttemptStatus;
use App\Modules\Dispatch\Enums\DispatchStatus;
use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Modules\Dispatch\Http\Requests\ReportDispatchJobDelayRequest;
use App\Modules\Dispatch\Http\Requests\TransitionDispatchJobRequest;
use App\Modules\Dispatch\Http\Resources\V1\DispatchJobResource;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\DispatchJobDelay;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use App\Platform\Identity\Enums\PermissionName;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\DispatchDelayNotification;
use App\Platform\Notifications\Jobs\SendQueuedNotificationJob;
use App\Platform\Workspace\Events\WorkspaceUpdated;
use App\Shared\Http\Exceptions\VersionConflictException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;

final class FieldDispatchJobController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('viewAny', DispatchJob::class);
        $user = $request->user();

        $jobs = DispatchJob::query()
            ->whereIn('id', DispatchPersonnelAssignment::query()
                ->open()
                ->where('user_id', $user->id)
                ->select('dispatch_job_id'))
            ->with($this->assignmentRelations($user))
            ->latest('scheduled_start')
            ->paginate(25);

        $response = DispatchJobResource::collection($jobs)->response();
        $this->addDeprecationHeaders($response);

        return $response;
    }

    public function show(Request $request, DispatchJob $dispatchJob): JsonResponse
    {
        abort_unless(Gate::forUser($request->user())->allows('viewAssigned', $dispatchJob), 404);

        $this->loadAssignmentRelations($dispatchJob, $request->user());

        $response = response()->json(['data' => new DispatchJobResource($dispatchJob)]);
        $this->addDeprecationHeaders($response, $dispatchJob);

        return $response;
    }

    public function respondAssignment(
        RespondToDispatchAssignmentRequest $request,
        DispatchJob $dispatchJob,
        DispatchPersonnelAssignment $assignment,
        RespondToDispatchAssignment $action,
        IdempotentCommandService $idempotency,
        DispatchV2Commands $commands,
    ): JsonResponse {
        $commandId = $idempotency->resolveCommandId($request, required: true);

        $execute = function () use ($request, $dispatchJob, $assignment, $action, $commands, $commandId): JsonResponse {
            $expectedVersion = (int) $request->validated('version');
            $responseType = AssignmentResponse::from($request->validated('response'));
            $attempt = $this->resolveV2Attempt($dispatchJob);

            $offer = $attempt?->offers()->where('legacy_assignment_id', $assignment->id)->first()
                ?? $attempt?->offers()->where('user_id', $assignment->user_id)->first();

            if (config('dispatch.v2_commands_enabled') && $attempt !== null && $offer !== null) {
                $mutation = DispatchV2Mutation::forVersion(
                    expectedVersion: $expectedVersion,
                    idempotencyKey: $commandId,
                    reason: $request->validated('reason'),
                );

                try {
                    if ($responseType === AssignmentResponse::Accepted) {
                        $commands->acceptOffer($request->user(), $offer, $mutation);
                    } else {
                        $commands->rejectOffer($request->user(), $offer, $mutation);
                    }
                } catch (DispatchV2CommandException $e) {
                    $this->handleV2CommandException($e, $dispatchJob, $attempt, $request, $expectedVersion);
                }

                $assignment->update([
                    'response_status' => $responseType,
                    'responded_at' => now(),
                    'response_reason' => $request->validated('reason'),
                ]);
                $dispatchJob->update(['version' => $attempt->fresh()->version]);
            } else {
                try {
                    $action->handle(
                        $request->user(),
                        $dispatchJob,
                        $assignment,
                        $responseType,
                        $request->validated('reason'),
                        $expectedVersion,
                    );
                } catch (ValidationException $e) {
                    if (isset($e->errors()['version'])) {
                        $freshJob = DispatchJob::query()->find($dispatchJob->id);
                        if ($freshJob !== null) {
                            $this->loadAssignmentRelations($freshJob, $request->user());
                        }

                        throw new VersionConflictException(
                            $e->getMessage(),
                            $freshJob ? $freshJob->version : $expectedVersion,
                            $freshJob ? (new DispatchJobResource($freshJob))->resolve($request) : null,
                        );
                    }

                    throw $e;
                }
            }

            $freshJob = DispatchJob::query()
                ->with($this->assignmentRelations($request->user()))
                ->findOrFail($dispatchJob->id);

            $response = response()->json(['data' => new DispatchJobResource($freshJob)]);
            $this->addDeprecationHeaders($response, $dispatchJob);

            return $response;
        };

        $response = $idempotency->process(
            $request->user(),
            $commandId,
            'dispatch.assignment_response',
            (int) $request->validated('version'),
            $execute,
            [
                'dispatch_job_id' => $dispatchJob->id,
                'assignment_id' => $assignment->id,
                ...$request->validated(),
            ],
        );
        assert($response instanceof JsonResponse);

        return $response;
    }

    public function transitionStatus(
        TransitionDispatchJobRequest $request,
        DispatchJob $dispatchJob,
        TransitionDispatchJob $action,
        IdempotentCommandService $idempotency,
        DispatchV2Commands $commands,
    ): JsonResponse {
        $commandId = $idempotency->resolveCommandId($request, required: true);

        $execute = function () use ($request, $dispatchJob, $action, $commands, $commandId): JsonResponse {
            $statusStr = (string) $request->validated('status');
            $expectedVersion = (int) $request->validated('version');
            $attempt = $this->resolveV2Attempt($dispatchJob);
            $hasV2Plan = $attempt !== null && $attempt->planVersions()->whereIn('status', ['approved', 'submitted'])->exists();

            if (config('dispatch.v2_commands_enabled') && $attempt !== null && ($hasV2Plan || $attempt->offers()->exists())) {
                $mutation = DispatchV2Mutation::forVersion(
                    expectedVersion: $expectedVersion,
                    idempotencyKey: $commandId,
                    reason: $request->validated('reason'),
                );

                try {
                    if ($statusStr === 'accepted') {
                        $offer = $attempt->offers()->where('user_id', $request->user()->id)->first();
                        if ($offer !== null && $offer->status !== DispatchAssignmentOfferStatus::Accepted) {
                            $commands->acceptOffer($request->user(), $offer, $mutation);
                        }

                        $legacyAssignment = $dispatchJob->personnelAssignments()
                            ->where('user_id', $request->user()->id)
                            ->open()
                            ->first();

                        if ($legacyAssignment !== null) {
                            $legacyAssignment->update([
                                'response_status' => AssignmentResponse::Accepted,
                                'responded_at' => now(),
                            ]);
                        }
                    } elseif ($statusStr === 'cancelled') {
                        $commands->cancel($request->user(), $attempt, $mutation);
                        $dispatchJob->update([
                            'status' => DispatchStatus::Cancelled,
                            'version' => $attempt->fresh()->version,
                        ]);
                    } elseif (in_array($statusStr, ['en_route', 'arrived', 'working', 'completed'], true)) {
                        $attemptStatus = match ($statusStr) {
                            'en_route' => DispatchAttemptStatus::EnRoute,
                            'arrived' => DispatchAttemptStatus::Arrived,
                            'working' => DispatchAttemptStatus::Working,
                            'completed' => DispatchAttemptStatus::Completed,
                        };

                        $commands->progress($request->user(), $attempt, $attemptStatus, $mutation);
                        $dispatchJob->update([
                            'status' => DispatchStatus::from($statusStr),
                            'version' => $attempt->fresh()->version,
                        ]);
                    }
                } catch (DispatchV2CommandException $e) {
                    $this->handleV2CommandException($e, $dispatchJob, $attempt, $request, $expectedVersion);
                }
            } else {
                try {
                    $updatedJob = $action->handle(
                        $request->user(),
                        $dispatchJob,
                        DispatchStatus::from($statusStr),
                        $expectedVersion,
                    );
                    $dispatchJob = $updatedJob;
                    if ($attempt !== null) {
                        $attempt->update([
                            'status' => match ($statusStr) {
                                'dispatched' => DispatchAttemptStatus::Dispatched,
                                'en_route' => DispatchAttemptStatus::EnRoute,
                                'arrived' => DispatchAttemptStatus::Arrived,
                                'working' => DispatchAttemptStatus::Working,
                                'completed' => DispatchAttemptStatus::Completed,
                                'cancelled' => DispatchAttemptStatus::Cancelled,
                                default => $attempt->status,
                            },
                            'version' => $updatedJob->version,
                        ]);
                    }
                } catch (ValidationException $e) {
                    if (isset($e->errors()['version'])) {
                        $freshJob = DispatchJob::query()->find($dispatchJob->id);
                        if ($freshJob !== null) {
                            $this->loadAssignmentRelations($freshJob, $request->user());
                        }

                        throw new VersionConflictException(
                            $e->getMessage(),
                            $freshJob ? $freshJob->version : $expectedVersion,
                            $freshJob ? (new DispatchJobResource($freshJob))->resolve($request) : null,
                        );
                    }

                    throw $e;
                }
            }

            $freshJob = DispatchJob::query()
                ->with($this->assignmentRelations($request->user()))
                ->findOrFail($dispatchJob->id);

            $response = response()->json(['data' => new DispatchJobResource($freshJob)]);
            $this->addDeprecationHeaders($response, $dispatchJob);

            return $response;
        };

        $response = $idempotency->process(
            $request->user(),
            $commandId,
            'dispatch.status_transition',
            (int) $request->validated('version'),
            $execute,
            [
                'dispatch_job_id' => $dispatchJob->id,
                ...$request->validated(),
            ],
        );
        assert($response instanceof JsonResponse);

        return $response;
    }

    private function resolveV2Attempt(DispatchJob $job): ?DispatchExecutionAttempt
    {
        return $job->canonicalHandoff?->attempts()->latest('attempt_number')->first()
            ?? $job->currentAttempt
            ?? $job->attempts()->latest('attempt_number')->first();
    }

    private function addDeprecationHeaders(JsonResponse $response, ?DispatchJob $job = null): void
    {
        $response->headers->set('Deprecation', '@1755129600');
        $response->headers->set('Sunset', 'Sun, 14 Feb 2027 00:00:00 GMT');
        if ($job !== null) {
            $response->headers->set('Link', '</api/v2/dispatch-jobs/'.$job->id.'>; rel="successor-version"');
        } else {
            $response->headers->set('Link', '</api/v2/dispatch-jobs>; rel="successor-version"');
        }
    }

    private function handleV2CommandException(
        DispatchV2CommandException $e,
        DispatchJob $dispatchJob,
        DispatchExecutionAttempt $attempt,
        Request $request,
        int $expectedVersion,
    ): never {
        if ($e->getErrorCode() === DispatchV2CommandCode::StaleVersion) {
            $freshJob = DispatchJob::query()->find($dispatchJob->id);
            if ($freshJob !== null) {
                $this->loadAssignmentRelations($freshJob, $request->user());
            }

            throw new VersionConflictException(
                $e->getMessage(),
                $attempt->fresh()->version,
                $freshJob ? (new DispatchJobResource($freshJob))->resolve($request) : null,
            );
        }

        if ($e->getErrorCode() === DispatchV2CommandCode::Forbidden) {
            abort(403, $e->getMessage());
        }

        throw ValidationException::withMessages([
            'status' => [$e->getMessage()],
        ]);
    }

    public function reportDelay(
        ReportDispatchJobDelayRequest $request,
        DispatchJob $dispatchJob,
        IdempotentCommandService $idempotency,
        RecordAuditEvent $audit,
    ): JsonResponse {
        $actor = $request->user();

        // 1. Authorization: user must have managerial dispatch permissions OR be an assigned worker on this job with dispatch permissions
        $isManager = $actor->can(PermissionName::DispatchUpdate->value);
        $isAssignedWorker = $actor->can(PermissionName::DispatchUpdateOwnStatus->value)
            && $dispatchJob->personnelAssignments()->open()->where('user_id', $actor->id)->exists();

        if (! $isManager && ! $isAssignedWorker) {
            abort(403, 'You are not authorized to report delays for this dispatch job.');
        }

        // 2. State eligibility check: delays cannot be reported for draft, cancelled, or completed jobs
        if (in_array($dispatchJob->status, [DispatchStatus::Draft, DispatchStatus::Cancelled, DispatchStatus::Completed], true)) {
            throw ValidationException::withMessages([
                'status' => ['Delays cannot be reported for this dispatch job status.'],
            ]);
        }

        $commandId = $idempotency->resolveCommandId($request, required: true);
        $expectedVersion = $request->validated('version') !== null ? (int) $request->validated('version') : null;

        $execute = function () use ($request, $dispatchJob, $actor, $expectedVersion, $audit, $commandId): JsonResponse {
            $lockedJob = DispatchJob::query()->lockForUpdate()->findOrFail($dispatchJob->id);

            if (in_array($lockedJob->status, [DispatchStatus::Draft, DispatchStatus::Cancelled, DispatchStatus::Completed], true)) {
                throw ValidationException::withMessages([
                    'status' => ['Delays cannot be reported for this dispatch job status.'],
                ]);
            }

            if ($expectedVersion !== null && $expectedVersion > 0 && $lockedJob->version !== $expectedVersion) {
                $this->loadAssignmentRelations($lockedJob, $actor);
                throw new VersionConflictException(
                    'This dispatch changed after you opened it. Refresh and review before trying again.',
                    $lockedJob->version,
                    (new DispatchJobResource($lockedJob))->resolve($request),
                );
            }

            $context = DelayContext::from((string) $request->validated('context'));
            $reasonEnum = $request->resolvedDelayReason($context);
            $reasonLabel = (string) ($request->validated('reason_label') ?: $reasonEnum->label());
            $assetId = $request->resolvedAssetId();
            $attempt = $lockedJob->currentAttempt ?? $this->resolveV2Attempt($lockedJob);
            $reportedAt = $request->validated('reported_at')
                ? Carbon::parse((string) $request->validated('reported_at'))
                : now();

            $delay = DispatchJobDelay::query()->create([
                'workspace_key' => 'operations',
                'dispatch_job_id' => $lockedJob->id,
                'dispatch_execution_attempt_id' => $attempt?->id,
                'operational_asset_id' => $assetId,
                'reported_by' => $actor->id,
                'context' => $context,
                'reason' => $reasonEnum->value,
                'reason_label' => $reasonLabel,
                'estimated_minutes' => $request->validated('estimated_minutes'),
                'notes' => $request->validated('notes'),
                'job_version' => $lockedJob->version,
                'reported_at' => $reportedAt,
                'command_id' => $commandId,
            ]);

            // Append timeline audit event
            $audit->handle(
                $actor,
                $lockedJob,
                'dispatch.delay_reported',
                null,
                [
                    'delay_id' => $delay->id,
                    'context' => $context->value,
                    'reason' => $reasonEnum->value,
                    'reason_label' => $reasonLabel,
                    'estimated_minutes' => $delay->estimated_minutes,
                    'notes' => $delay->notes,
                    'operational_asset_id' => $delay->operational_asset_id,
                    'reported_at' => $delay->reported_at->toIso8601String(),
                ]
            );

            // Send notification and broadcast after transaction successfully commits
            $delay->loadMissing('operationalAsset:id,code,name');
            $assetCode = $delay->operationalAsset?->code;

            DB::afterCommit(function () use ($actor, $lockedJob, $reasonLabel, $context, $delay, $assetCode): void {
                $dispatchers = User::query()
                    ->where('is_active', true)
                    ->where('id', '!=', $actor->id)
                    ->permission(PermissionName::DispatchViewAll->value)
                    ->get();

                foreach ($dispatchers as $dispatcher) {
                    SendQueuedNotificationJob::dispatch(
                        $dispatcher,
                        new DispatchDelayNotification(
                            job: $lockedJob,
                            reason: $reasonLabel,
                            context: $context->value,
                            estimatedMinutes: $delay->estimated_minutes,
                            notes: $delay->notes,
                            assetCode: $assetCode,
                            reporterName: $actor->name,
                        )
                    );
                }

                WorkspaceUpdated::dispatch('job', 'updated');
            });

            $freshJob = DispatchJob::query()
                ->with($this->assignmentRelations($actor))
                ->findOrFail($lockedJob->id);

            return response()->json([
                'data' => [
                    'delay' => [
                        'id' => $delay->id,
                        'dispatch_job_id' => $delay->dispatch_job_id,
                        'context' => $delay->context->value,
                        'context_label' => $delay->context->label(),
                        'reason' => $delay->reason,
                        'reason_label' => $delay->reason_label,
                        'estimated_minutes' => $delay->estimated_minutes,
                        'notes' => $delay->notes,
                        'operational_asset_id' => $delay->operational_asset_id,
                        'reported_by' => [
                            'id' => $actor->id,
                            'name' => $actor->name,
                        ],
                        'reported_at' => $delay->reported_at->toIso8601String(),
                        'created_at' => $delay->created_at->toIso8601String(),
                    ],
                    'job' => new DispatchJobResource($freshJob),
                ],
            ], 201);
        };

        $response = $idempotency->process(
            $actor,
            $commandId,
            'dispatch.delay_reported',
            $expectedVersion,
            $execute,
            [
                'dispatch_job_id' => $dispatchJob->id,
                ...$request->validated(),
            ],
        );
        assert($response instanceof JsonResponse);

        return $response;
    }

    /**
     * @return array<int|string, \Closure|string>
     */
    private function assignmentRelations(User $user): array
    {
        $canViewAll = $user->can(PermissionName::DispatchViewAll->value);

        return [
            'personnelAssignments' => function ($query) use ($user, $canViewAll): void {
                $query->open()
                    ->when(! $canViewAll, fn ($query) => $query->where('user_id', $user->id))
                    ->with('user:id,name');
            },
            'assetAssignments' => fn ($query) => $query
                ->open()
                ->with('asset'),
            'latestJobLevelDelay',
            'latestJobLevelDelay.reporter',
            'delays',
            'delays.reporter',
        ];
    }

    private function loadAssignmentRelations(DispatchJob $job, User $user): void
    {
        $job->load($this->assignmentRelations($user));
    }
}
