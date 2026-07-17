<?php

use App\Http\Controllers\ApprovalRequestController;
use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Auth\EmailVerificationController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\DispatchJobController;
use App\Http\Controllers\DispatchWorkflowController;
use App\Http\Controllers\FuelRequestController;
use App\Http\Controllers\InspectionController;
use App\Http\Controllers\LocationUpdateController;
use App\Http\Controllers\MaintenanceWorkOrderController;
use App\Http\Controllers\OperationalAssetController;
use App\Http\Controllers\OperationsWorkspaceController;
use App\Http\Controllers\PersonnelController;
use App\Http\Controllers\ServiceRequestController;
use App\Http\Controllers\UserManagementController;
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
        Route::get('/dispatch-jobs/{dispatchJob}', [DispatchJobController::class, 'show']);
        Route::post('/dispatch-jobs/{dispatchJob}/assignments', [DispatchWorkflowController::class, 'assign']);
        Route::post('/dispatch-jobs/{dispatchJob}/activate', [DispatchWorkflowController::class, 'activate']);
        Route::post('/dispatch-jobs/{dispatchJob}/status', [DispatchWorkflowController::class, 'transition']);
        Route::post('/approval-requests/{approvalRequest}/decision', [ApprovalRequestController::class, 'decide']);
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
    });
});

if (app()->environment('local')) {
    Route::get('/dev/users', function () {
        return response()->json(\App\Models\User::query()->select('id', 'name', 'email')->get());
    });

    Route::post('/dev/login/{user}', function (\App\Models\User $user) {
        \Illuminate\Support\Facades\Auth::login($user);
        return redirect()->route('home');
    });
}
