<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->timestamp('completed_at')->nullable()->index();
            $table->timestamp('cancelled_at')->nullable()->index();
        });

        $this->backfillFromAuditTrail();
    }

    public function down(): void
    {
        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->dropIndex(['completed_at']);
            $table->dropIndex(['cancelled_at']);
            $table->dropColumn(['completed_at', 'cancelled_at']);
        });
    }

    /**
     * Finished jobs get a finish time only when the audit trail recorded the
     * transition. Jobs without that evidence keep null rather than a guess.
     */
    private function backfillFromAuditTrail(): void
    {
        $columns = ['completed' => 'completed_at', 'cancelled' => 'cancelled_at'];

        DB::table('dispatch_jobs')
            ->whereIn('status', array_keys($columns))
            ->orderBy('id')
            ->select(['id', 'status'])
            ->chunkById(200, function ($jobs) use ($columns): void {
                foreach ($jobs as $job) {
                    $events = DB::table('audit_events')
                        ->where('subject_id', $job->id)
                        ->where('subject_type', 'like', '%DispatchJob')
                        ->whereIn('action', ['dispatch.status_updated', 'dispatch.cancelled'])
                        ->orderByDesc('occurred_at')
                        ->get(['after', 'occurred_at']);

                    $finishedAt = $events->first(function ($event) use ($job): bool {
                        $after = json_decode((string) $event->after, true);

                        return is_array($after) && ($after['status'] ?? null) === $job->status;
                    })?->occurred_at;

                    if ($finishedAt !== null) {
                        DB::table('dispatch_jobs')
                            ->where('id', $job->id)
                            ->update([$columns[$job->status] => $finishedAt]);
                    }
                }
            });
    }
};
