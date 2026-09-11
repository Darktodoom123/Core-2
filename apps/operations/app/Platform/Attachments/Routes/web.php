<?php

use App\Platform\Attachments\Http\Controllers\AttachmentController;
use Illuminate\Support\Facades\Route;

Route::middleware(['auth', 'active', 'verified'])->prefix('operations')->group(function (): void {
    Route::post('/attachments', [AttachmentController::class, 'store'])->middleware('throttle:uploads');
    Route::get('/attachments/{attachment}/download', [AttachmentController::class, 'download'])->middleware('throttle:downloads');
});
