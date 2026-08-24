<?php

namespace App\Platform\Workspace\Support;

use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class WorkspacePerformanceCollector
{
    private bool $active = false;

    private int $queryCount = 0;

    private float $databaseTimeMs = 0.0;

    private float $startedAt = 0.0;

    public function start(): void
    {
        $this->active = true;
        $this->queryCount = 0;
        $this->databaseTimeMs = 0.0;
        $this->startedAt = hrtime(true) / 1_000_000;
    }

    public function recordQuery(float $timeMs): void
    {
        if (! $this->active) {
            return;
        }

        $this->queryCount++;
        $this->databaseTimeMs += $timeMs;
    }

    /** @return array<string, mixed> */
    public function finish(Request $request, Response $response): array
    {
        if (! $this->active) {
            return [];
        }

        $this->active = false;
        $content = $response->getContent();
        $user = $request->user();
        $role = $user?->relationLoaded('roles')
            ? $user->getRelation('roles')->first()?->name
            : null;
        $partialProps = $request->header('X-Inertia-Partial-Data');
        $mode = $request->attributes->get('workspace_inertia_mode');
        if (! is_string($mode)) {
            $mode = ! $request->header('X-Inertia')
                ? 'full'
                : ($partialProps !== null ? 'partial' : 'full');
        }

        return [
            'route' => $request->route()?->getName() ?? $request->path(),
            'status' => $response->getStatusCode(),
            'total_duration_ms' => round((hrtime(true) / 1_000_000) - $this->startedAt, 2),
            'query_count' => $this->queryCount,
            'database_time_ms' => round($this->databaseTimeMs, 2),
            'response_bytes' => is_string($content) ? strlen($content) : 0,
            'inertia_mode' => $mode,
            'requested_props' => $this->requestedProps($partialProps),
            'role' => is_string($role) ? $role : 'unknown',
            'candidate_page_size' => $request->attributes->get('candidate_page_size'),
            'candidate_result_count' => $request->attributes->get('candidate_result_count'),
            'candidate_resource' => $request->attributes->get('candidate_resource'),
        ];
    }

    /** @return list<string> */
    private function requestedProps(?string $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        return array_values(array_filter(array_map(
            static fn (string $prop): string => trim($prop),
            explode(',', $value),
        ), static fn (string $prop): bool => $prop !== ''));
    }
}
