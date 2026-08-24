<?php

namespace App\Modules\Assignment\Data;

use App\Modules\Dispatch\Models\DispatchJob;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

/** @template T of array<string, mixed> */
final readonly class CandidatePage
{
    /**
     * @param  list<T>  $data
     * @param  array{current_page: int, last_page: int, per_page: int, total: int, from: int|null, to: int|null}  $pagination
     */
    public function __construct(
        public array $data,
        public array $pagination,
        public string $evaluatedAt,
        public int $jobVersion,
        public string $scheduleFingerprint,
        public ?string $error = null,
    ) {}

    /**
     * @param  LengthAwarePaginator<int, mixed>  $results
     * @param  list<T>  $data
     * @return self<T>
     */
    public static function fromPaginator(
        LengthAwarePaginator $results,
        DispatchJob $job,
        array $data,
        ?string $error = null,
    ): self {
        return new self(
            data: $data,
            pagination: [
                'current_page' => $results->currentPage(),
                'last_page' => $results->lastPage(),
                'per_page' => $results->perPage(),
                'total' => $results->total(),
                'from' => $results->firstItem(),
                'to' => $results->lastItem(),
            ],
            evaluatedAt: now()->toIso8601String(),
            jobVersion: (int) $job->version,
            scheduleFingerprint: self::fingerprint($job),
            error: $error,
        );
    }

    /** @return self<array<string, mixed>> */
    public static function error(DispatchJob $job, string $message): self
    {
        return new self(
            data: [],
            pagination: [
                'current_page' => 1,
                'last_page' => 1,
                'per_page' => 25,
                'total' => 0,
                'from' => null,
                'to' => null,
            ],
            evaluatedAt: now()->toIso8601String(),
            jobVersion: (int) $job->version,
            scheduleFingerprint: self::fingerprint($job),
            error: $message,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'data' => $this->data,
            'pagination' => $this->pagination,
            'evaluated_at' => $this->evaluatedAt,
            'job_version' => $this->jobVersion,
            'schedule_fingerprint' => $this->scheduleFingerprint,
            'error' => $this->error,
        ];
    }

    private static function fingerprint(DispatchJob $job): string
    {
        return hash('sha256', implode('|', [
            (string) $job->getKey(),
            (string) $job->version,
            $job->scheduled_start?->toIso8601String() ?? 'incomplete',
            $job->scheduled_end?->toIso8601String() ?? 'incomplete',
        ]));
    }
}
