<?php

namespace App\Platform\Workspace\Http\Middleware;

use App\Platform\Workspace\Support\WorkspacePerformanceCollector;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

final class CollectWorkspacePerformance
{
    public function __construct(private readonly WorkspacePerformanceCollector $collector) {}

    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->monitored($request)) {
            return $next($request);
        }

        $this->collector->start();
        $response = $next($request);
        $metrics = $this->collector->finish($request, $response);

        if (app()->environment(['local', 'staging'])) {
            $response->headers->set('Server-Timing', sprintf(
                'app;dur=%s, db;dur=%s, db-queries;desc="%s queries"',
                $metrics['total_duration_ms'],
                $metrics['database_time_ms'],
                $metrics['query_count'],
            ));
            $response->headers->set('X-Workspace-Query-Count', (string) $metrics['query_count']);
            $response->headers->set('X-Workspace-Db-Time-Ms', (string) $metrics['database_time_ms']);
            $response->headers->set('X-Workspace-Payload-Bytes', (string) $metrics['response_bytes']);
        }

        if (app()->environment('production')) {
            Log::info('workspace.request_performance', $metrics);
        }

        return $response;
    }

    private function monitored(Request $request): bool
    {
        if (! $request->isMethod('GET')) {
            return false;
        }

        return $request->path() === '/'
            || preg_match('#^operations/dispatch-jobs/[0-9]+$#', $request->path()) === 1;
    }
}
