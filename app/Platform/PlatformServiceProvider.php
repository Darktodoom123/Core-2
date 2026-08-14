<?php

namespace App\Platform;

use App\Modules\Assignment\Models\DispatchAssetAssignment;
use App\Modules\Assignment\Models\DispatchPersonnelAssignment;
use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\Client;
use App\Modules\Dispatch\Models\DispatchJob;
use App\Modules\Dispatch\Models\ServiceRequest;
use App\Modules\Fuel\Models\FuelLog;
use App\Modules\Fuel\Models\FuelRequest;
use App\Modules\Rental\Models\RentalReservation;
use App\Modules\Sales\Models\SalesOrder;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Attachments\Policies\AttachmentPolicy;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Gpt\Models\GptRecommendation;
use App\Platform\Gpt\Policies\GptRecommendationPolicy;
use App\Platform\Idempotency\Models\CommandLog;
use App\Platform\Identity\Models\PersonnelCredential;
use App\Platform\Identity\Models\PersonnelProfile;
use App\Platform\Identity\Models\User;
use App\Platform\Notifications\Models\Notification;
use App\Platform\Notifications\Policies\NotificationPolicy;
use App\Platform\Reporting\Models\JobReport;
use App\Platform\Reporting\Policies\JobReportPolicy;
use App\Platform\Tracking\Models\LocationUpdate;
use App\Platform\Workspace\Observers\WorkspaceResourceObserver;
use App\Shared\Assets\Models\Inspection;
use App\Shared\Assets\Models\MaintenanceWorkOrder;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

final class PlatformServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        Gate::policy(Attachment::class, AttachmentPolicy::class);
        Gate::policy(GptRecommendation::class, GptRecommendationPolicy::class);
        Gate::policy(JobReport::class, JobReportPolicy::class);
        Gate::policy(Notification::class, NotificationPolicy::class);

        DispatchJob::observe(WorkspaceResourceObserver::class);
        DispatchAssetAssignment::observe(WorkspaceResourceObserver::class);
        DispatchPersonnelAssignment::observe(WorkspaceResourceObserver::class);
        ApprovalRequest::observe(WorkspaceResourceObserver::class);
        FuelRequest::observe(WorkspaceResourceObserver::class);
        OperationalAsset::observe(WorkspaceResourceObserver::class);

        // Preserve polymorphic rows created before model namespaces became module-oriented.
        Relation::morphMap([
            'rental_reservation' => RentalReservation::class,
            'sales_order' => SalesOrder::class,
            'service_request' => ServiceRequest::class,
            'App\\Models\\ApprovalRequest' => ApprovalRequest::class,
            'App\\Models\\Attachment' => Attachment::class,
            'App\\Models\\AuditEvent' => AuditEvent::class,
            'App\\Models\\Client' => Client::class,
            'App\\Models\\CommandLog' => CommandLog::class,
            'App\\Models\\DispatchAssetAssignment' => DispatchAssetAssignment::class,
            'App\\Models\\DispatchJob' => DispatchJob::class,
            'App\\Models\\DispatchPersonnelAssignment' => DispatchPersonnelAssignment::class,
            'App\\Models\\FuelLog' => FuelLog::class,
            'App\\Models\\FuelRequest' => FuelRequest::class,
            'App\\Models\\GptRecommendation' => GptRecommendation::class,
            'App\\Models\\Inspection' => Inspection::class,
            'App\\Models\\JobReport' => JobReport::class,
            'App\\Models\\LocationUpdate' => LocationUpdate::class,
            'App\\Models\\MaintenanceWorkOrder' => MaintenanceWorkOrder::class,
            'App\\Models\\Notification' => Notification::class,
            'App\\Models\\OperationalAsset' => OperationalAsset::class,
            'App\\Models\\PersonnelCredential' => PersonnelCredential::class,
            'App\\Models\\PersonnelProfile' => PersonnelProfile::class,
            'App\\Models\\ServiceRequest' => ServiceRequest::class,
            'App\\Models\\User' => User::class,
        ]);
    }
}
