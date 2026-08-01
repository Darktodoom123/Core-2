<?php

namespace App\Modules\Dispatch;

use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Policies\ApprovalRequestPolicy;
use App\Modules\Dispatch\Policies\DispatchJobPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class DispatchServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(ApprovalRequest::class, ApprovalRequestPolicy::class);
        Gate::policy(DispatchJob::class, DispatchJobPolicy::class);
    }
}
