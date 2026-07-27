<?php

use App\Http\Controllers\ApprovalRequestController;
use App\Http\Controllers\AttachmentController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\DispatchJobController;
use App\Http\Controllers\DispatchWorkflowController;
use App\Http\Controllers\FuelRequestController;
use App\Http\Controllers\GptRecommendationController;
use App\Http\Controllers\InspectionController;
use App\Http\Controllers\JobReportController;
use App\Http\Controllers\LocationUpdateController;
use App\Http\Controllers\MaintenanceWorkOrderController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\OperationalAssetController;
use App\Http\Controllers\OperationsSummaryController;
use App\Http\Controllers\OperationsWorkspaceController;
use App\Http\Controllers\PersonnelController;
use App\Http\Controllers\ServiceRequestController;
use App\Http\Controllers\UserManagementController;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

Route::middleware('guest')->group(function (): void {
    Route::get('/login', [AuthenticatedSessionController::class, 'create'])->name('login');
    Route::post('/login', [AuthenticatedSessionController::class, 'store'])->middleware('throttle:5,1');
    Route::get('/forgot-password', [PasswordResetLinkController::class, 'create'])->name('password.request');
    Route::post('/forgot-password', [PasswordResetLinkController::class, 'store'])->middleware('throttle:5,1')->name('password.email');
    Route::get('/reset-password/{token}', [NewPasswordController::class, 'create'])->name('password.reset');
    Route::post('/reset-password', [NewPasswordController::class, 'store'])->name('password.store');
});

Route::middleware(['auth', 'active'])->group(function (): void {
    Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])->name('logout');
    Route::get('/verify-email', [EmailVerificationController::class, 'notice'])->name('verification.notice');
    Route::get('/verify-email/{id}/{hash}', [EmailVerificationController::class, 'verify'])
        ->middleware(['signed', 'throttle:6,1'])->name('verification.verify');
    Route::post('/email/verification-notification', [EmailVerificationController::class, 'resend'])
        ->middleware('throttle:6,1')->name('verification.send');
    Route::get('/', OperationsWorkspaceController::class)->middleware('verified')->name('home');

    Route::middleware(['verified', 'throttle:120,1'])->prefix('operations')->group(function (): void {
        Route::get('/clients', [ClientController::class, 'index']);
        Route::post('/clients', [ClientController::class, 'store']);
        Route::get('/service-requests', [ServiceRequestController::class, 'index']);
        Route::post('/service-requests', [ServiceRequestController::class, 'store']);
        Route::get('/dispatch-jobs', [DispatchJobController::class, 'index']);
        Route::post('/dispatch-jobs', [DispatchJobController::class, 'store']);
        Route::get('/dispatch-jobs/{dispatchJob}', [DispatchJobController::class, 'show'])->name('dispatch-jobs.show');
        Route::post('/dispatch-jobs/{dispatchJob}/assignments', [DispatchWorkflowController::class, 'assign']);
        Route::post('/dispatch-jobs/{dispatchJob}/reassign', [DispatchWorkflowController::class, 'reassign']);
        Route::post('/dispatch-jobs/{dispatchJob}/assignments/{assignment}/response', [DispatchWorkflowController::class, 'respondAssignment']);
        Route::post('/dispatch-jobs/{dispatchJob}/activate', [DispatchWorkflowController::class, 'activate']);
        Route::post('/dispatch-jobs/{dispatchJob}/cancel', [DispatchWorkflowController::class, 'cancel']);
        Route::post('/dispatch-jobs/{dispatchJob}/reopen', [DispatchWorkflowController::class, 'reopen']);
        Route::post('/dispatch-jobs/{dispatchJob}/archive', [DispatchWorkflowController::class, 'archive']);
        Route::post('/dispatch-jobs/{dispatchJob}/restore', [DispatchWorkflowController::class, 'restore']);
        Route::post('/dispatch-jobs/{dispatchJob}/status', [DispatchWorkflowController::class, 'transition']);
        Route::post('/approval-requests/{approvalRequest}/decision', [ApprovalRequestController::class, 'decide']);
        Route::get('/job-reports', [JobReportController::class, 'index']);
        Route::post('/job-reports', [JobReportController::class, 'store']);
        Route::get('/job-reports/{jobReport}', [JobReportController::class, 'show']);
        Route::post('/job-reports/{jobReport}/review', [JobReportController::class, 'review']);
        Route::post('/attachments', [AttachmentController::class, 'store']);
        Route::get('/attachments/{attachment}/download', [AttachmentController::class, 'download']);
        Route::get('/notifications', [NotificationController::class, 'index']);
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'markAsRead']);
        Route::get('/reports/daily-summary', [OperationsSummaryController::class, 'dailySummary']);
        Route::get('/fuel-requests', [FuelRequestController::class, 'index']);
        Route::post('/fuel-requests', [FuelRequestController::class, 'store']);
        Route::post('/fuel-requests/{fuelRequest}/status', [FuelRequestController::class, 'transition']);
        Route::get('/locations', [LocationUpdateController::class, 'index']);
        Route::post('/locations', [LocationUpdateController::class, 'store']);
        Route::get('/assets', [OperationalAssetController::class, 'index']);
        Route::post('/assets', [OperationalAssetController::class, 'store']);
        Route::post('/assets/{operationalAsset}/status', [OperationalAssetController::class, 'status']);
        Route::post('/assets/{operationalAsset}/inspections', [InspectionController::class, 'store']);
        Route::post('/assets/{operationalAsset}/maintenance', [MaintenanceWorkOrderController::class, 'store']);
        Route::post('/maintenance/{maintenanceWorkOrder}/release', [MaintenanceWorkOrderController::class, 'release']);
        Route::get('/users', [UserManagementController::class, 'index']);
        Route::post('/users', [UserManagementController::class, 'store']);
        Route::patch('/users/{user}', [UserManagementController::class, 'update']);
        Route::patch('/users/{user}/personnel-profile', [PersonnelController::class, 'updateProfile']);
        Route::post('/users/{user}/credentials', [PersonnelController::class, 'storeCredential']);
        Route::post('/gpt-recommendations', [GptRecommendationController::class, 'store']);
        Route::post('/gpt-recommendations/{recommendation}/accept', [GptRecommendationController::class, 'accept']);
        Route::post('/gpt-recommendations/{recommendation}/reject', [GptRecommendationController::class, 'reject']);
    });
});

if (app()->environment(['local', 'testing'])) {
    Route::get('/dev/users', function () {
        return response()->json(
            User::query()
                ->with('roles')
                ->select('id', 'name', 'email')
                ->where('is_active', true)
                ->whereNull('suspended_at')
                ->whereNotNull('email_verified_at')
                ->orderBy('name')
                ->get()
                ->map(static fn (User $user): array => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role_label' => $user->operationalRole()?->label(),
                ])
                ->values(),
        );
    });

    Route::post('/dev/login/{user}', function (User $user) {
        abort_unless(
            $user->is_active && $user->suspended_at === null && $user->hasVerifiedEmail(),
            404,
        );

        Auth::login($user);
        request()->session()->regenerate();

        return redirect()->route('home');
    })->whereNumber('user');
}
