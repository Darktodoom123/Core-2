<?php

namespace App\Modules\Assignment\Queries;

use App\Modules\Assignment\Data\CandidatePage;
use App\Modules\Assignment\Http\Requests\ListDispatchCandidatesRequest;
use App\Modules\Assignment\Services\DispatchResourceEligibility;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Platform\Identity\Enums\RoleName;
use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Builder;

final class PersonnelCandidateQuery
{
    public function __construct(private readonly DispatchResourceEligibility $eligibility) {}

    /** @return CandidatePage<array<string, mixed>> */
    public function page(DispatchJob $job, ListDispatchCandidatesRequest $filters): CandidatePage
    {
        if ($filters->resource() === 'assets') {
            return CandidatePage::error($job, 'Personnel candidates were not requested.');
        }

        if ($filters->eligibleOnly()) {
            return $this->eligiblePage($job, $filters);
        }

        $results = $this->query($job, $filters)->paginate(
            perPage: $filters->perPage(),
            columns: ['users.id', 'users.name', 'users.is_active', 'users.suspended_at'],
            pageName: 'personnel_page',
            page: $filters->page(),
        );

        $data = collect($results->items())
            ->map(fn (User $user): ?array => $this->assess($user, $job, $filters))
            ->filter()
            ->sortBy([
                ['eligible', 'desc'],
                ['name', 'asc'],
                ['id', 'asc'],
            ])
            ->values()
            ->all();

        $data = array_values($data);

        return CandidatePage::fromPaginator($results, $job, $data);
    }

    /** @return CandidatePage<array<string, mixed>> */
    private function eligiblePage(DispatchJob $job, ListDispatchCandidatesRequest $filters): CandidatePage
    {
        $eligible = [];
        $this->query($job, $filters)->reorder('users.id')->chunkById(100, function ($users) use ($job, $filters, &$eligible): void {
            foreach ($users as $user) {
                $candidate = $this->assess($user, $job, $filters);
                if ($candidate !== null && $candidate['eligible']) {
                    $eligible[] = $candidate;
                }
            }
        }, 'users.id', 'id');

        usort($eligible, static fn (array $left, array $right): int => [$left['name'], $left['id']] <=> [$right['name'], $right['id']]);

        return CandidatePage::fromEvaluated($eligible, $job, $filters->perPage(), $filters->page());
    }

    /** @return array<string, mixed>|null */
    private function assess(User $user, DispatchJob $job, ListDispatchCandidatesRequest $filters): ?array
    {
        $assignmentType = $filters->type() === 'driver'
            ? 'driver'
            : $this->eligibility->personnelAssignmentType($user);
        if ($assignmentType === null) {
            return null;
        }

        return [
            'id' => (int) $user->getKey(),
            'name' => $user->name,
            'assignment_type' => $assignmentType,
            'assignment_label' => $this->eligibility->personnelAssignmentLabel($assignmentType),
            ...$this->eligibility->personnel($user, $assignmentType, $job),
        ];
    }

    /** @return Builder<User> */
    private function query(DispatchJob $job, ListDispatchCandidatesRequest $filters): Builder
    {
        $roles = ListDispatchCandidatesRequest::personnelTypes();
        $scheduledStart = $job->scheduled_start?->toImmutable();
        $scheduledEnd = $job->scheduled_end?->toImmutable();

        return User::query()
            ->select(['users.id', 'users.name', 'users.is_active', 'users.suspended_at'])
            ->where('users.is_active', true)
            ->whereNull('users.suspended_at')
            ->whereHas('roles', function (Builder $query) use ($roles, $filters): void {
                $query->whereIn('name', $roles)
                    ->when($filters->type() !== null, fn (Builder $role): Builder => $role->where(
                        'name',
                        $filters->type() === 'driver' ? RoleName::CraneOperator->value : $filters->type(),
                    ));
            })
            ->with([
                'roles:id,name',
                'personnelProfile:user_id,availability_status',
                'personnelCredentials' => function ($query) use ($filters): void {
                    $query->select(['id', 'user_id', 'kind', 'issued_at', 'expires_at', 'status'])
                        ->when($filters->type() === 'driver', fn (Builder $credential): Builder => $credential->where('kind', 'driver_license'))
                        ->when($filters->type() === 'crane_operator', fn (Builder $credential): Builder => $credential->where('kind', 'operator_certification'));
                },
                'dispatchAssignments' => function ($query) use ($scheduledStart, $scheduledEnd): void {
                    $query->where(function (Builder $assignment): void {
                        $assignment->whereNull('active_until')->orWhere('active_until', '>', now());
                    })
                        ->when(
                            $scheduledStart !== null && $scheduledEnd !== null,
                            fn (Builder $assignment): Builder => $assignment->whereHas('job', function (Builder $dispatch) use ($scheduledStart, $scheduledEnd): void {
                                $dispatch->where(function (Builder $window) use ($scheduledStart, $scheduledEnd): void {
                                    $window->whereNull('scheduled_start')
                                        ->orWhereNull('scheduled_end')
                                        ->orWhere(function (Builder $complete) use ($scheduledStart, $scheduledEnd): void {
                                            $complete->where('scheduled_start', '<', $scheduledEnd)
                                                ->where('scheduled_end', '>', $scheduledStart);
                                        });
                                });
                            }),
                        )
                        ->with('job:id,reference,scheduled_start,scheduled_end');
                },
            ])
            ->when($filters->search() !== null, function (Builder $query) use ($filters): void {
                $search = $filters->search();
                $query->where(function (Builder $searchQuery) use ($search): void {
                    $searchQuery->where('users.name', 'like', "%{$search}%")
                        ->orWhereHas('roles', fn (Builder $role): Builder => $role->where('name', 'like', "%{$search}%"));
                });
            })
            ->orderBy('users.name')
            ->orderBy('users.id');
    }
}
