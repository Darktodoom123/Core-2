<?php

namespace App\Modules\Dispatch;

use App\Modules\Dispatch\Console\Commands\DispatchV2RolloutStatusCommand;
use App\Modules\Dispatch\Console\Commands\ReconcileDispatchV2Command;
use App\Modules\Dispatch\Contracts\DispatchOutboxDeliveryHandler;
use App\Modules\Dispatch\Contracts\DispatchOutboxRecorder;
use App\Modules\Dispatch\Contracts\DispatchScheduleReader;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchExecutionAttempt;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Policies\ApprovalRequestPolicy;
use App\Modules\Dispatch\Policies\DispatchExecutionAttemptPolicy;
use App\Modules\Dispatch\Policies\DispatchJobPolicy;
use App\Modules\Dispatch\Services\DispatchOutboxIntentRecorder;
use App\Modules\Dispatch\Services\EloquentDispatchScheduleReader;
use App\Modules\Dispatch\Services\NullDispatchOutboxDeliveryHandler;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Audit\Contracts\AuditEventRecorder;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class DispatchServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->singleton(DispatchScheduleReader::class, EloquentDispatchScheduleReader::class);
        $this->app->bind(AuditEventRecorder::class, RecordAuditEvent::class);
        $this->app->bind(DispatchOutboxRecorder::class, DispatchOutboxIntentRecorder::class);
        $this->app->bind(DispatchOutboxDeliveryHandler::class, NullDispatchOutboxDeliveryHandler::class);
    }

    public function boot(): void
    {
        $this->commands([
            ReconcileDispatchV2Command::class,
            DispatchV2RolloutStatusCommand::class,
        ]);
        Gate::policy(ApprovalRequest::class, ApprovalRequestPolicy::class);
        Gate::policy(DispatchExecutionAttempt::class, DispatchExecutionAttemptPolicy::class);
        Gate::policy(DispatchJob::class, DispatchJobPolicy::class);
    }
}
