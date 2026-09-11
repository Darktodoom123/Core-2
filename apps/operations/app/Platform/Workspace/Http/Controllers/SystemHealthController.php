<?php

namespace App\Platform\Workspace\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Dispatch\Models\DispatchOutboxMessage;
use App\Platform\Identity\Enums\RoleName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

final class SystemHealthController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $actor = $request->user();
        abort_unless($actor->hasRole(RoleName::SystemAdministrator->value), 403);

        // 1. Database Check & Latency
        $dbStart = microtime(true);
        $dbOk = false;
        try {
            DB::select('SELECT 1');
            $dbLatencyMs = round((microtime(true) - $dbStart) * 1000, 2);
            $dbOk = true;
        } catch (\Throwable) {
            $dbLatencyMs = null;
        }

        // 2. Cache / Redis Check
        $cacheStart = microtime(true);
        $cacheOk = false;
        try {
            Cache::put('health_ping', 'ok', 10);
            $cacheOk = Cache::get('health_ping') === 'ok';
            $cacheLatencyMs = round((microtime(true) - $cacheStart) * 1000, 2);
        } catch (\Throwable) {
            $cacheLatencyMs = null;
        }

        // 3. Outbox Telemetry & Dead-Letter Messages
        $outboxPending = DispatchOutboxMessage::query()->where('status', 'pending')->count();
        $outboxFailed = DispatchOutboxMessage::query()->where('status', 'failed')->count();
        $outboxDelivered = DispatchOutboxMessage::query()->where('status', 'delivered')->count();

        // 4. Failed Jobs
        $failedJobsCount = DB::table('failed_jobs')->count();

        // 5. System Status Summary
        $overallHealthy = $dbOk && $cacheOk && $outboxFailed === 0 && $failedJobsCount === 0;

        return response()->json([
            'status' => $overallHealthy ? 'healthy' : ($dbOk ? 'degraded' : 'unhealthy'),
            'timestamp' => now()->toIso8601String(),
            'services' => [
                'database' => [
                    'status' => $dbOk ? 'operational' : 'offline',
                    'latency_ms' => $dbLatencyMs,
                ],
                'cache' => [
                    'status' => $cacheOk ? 'operational' : 'offline',
                    'latency_ms' => $cacheLatencyMs,
                ],
                'outbox' => [
                    'status' => $outboxFailed > 0 ? 'attention_needed' : 'operational',
                    'pending' => $outboxPending,
                    'failed' => $outboxFailed,
                    'delivered' => $outboxDelivered,
                ],
                'queues' => [
                    'status' => $failedJobsCount > 0 ? 'failed_jobs_detected' : 'operational',
                    'failed_jobs' => $failedJobsCount,
                ],
                'websockets' => [
                    'driver' => config('broadcasting.default'),
                    'status' => 'operational',
                ],
            ],
        ]);
    }
}
