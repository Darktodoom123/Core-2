<?php

namespace App\Http\Controllers;

use App\Actions\UploadAttachmentAction;
use App\Http\Requests\UploadAttachmentRequest;
use App\Models\Attachment;
use App\Models\AuditEvent;
use App\Models\DispatchJob;
use App\Models\FuelRequest;
use App\Models\JobReport;
use App\Models\OperationalAsset;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    public function store(UploadAttachmentRequest $request, UploadAttachmentAction $action): RedirectResponse|JsonResponse
    {
        $ownerType = $request->input('owner_type');
        $ownerId = (int) $request->input('owner_id');

        $morphClass = match ($ownerType) {
            'job_report', 'JobReport', 'job_reports' => JobReport::class,
            'dispatch_job', 'DispatchJob', 'dispatch_jobs' => DispatchJob::class,
            'operational_asset', 'OperationalAsset', 'operational_assets' => OperationalAsset::class,
            'fuel_request', 'FuelRequest', 'fuel_requests' => FuelRequest::class,
            default => $ownerType,
        };

        /** @var Model $owner */
        $owner = $morphClass::query()->findOrFail($ownerId);

        $retentionUntil = $request->input('retention_until')
            ? Carbon::parse($request->input('retention_until'))
            : null;

        $attachment = $action->execute(
            $request->user(),
            $owner,
            $request->file('file'),
            $request->input('kind', 'document'),
            $retentionUntil
        );

        if ($request->wantsJson()) {
            return response()->json(['data' => $attachment], 201);
        }

        return redirect()->back()->with('flash', [
            'type' => 'success',
            'message' => 'Attachment uploaded successfully.',
        ]);
    }

    public function download(Attachment $attachment, Request $request): StreamedResponse
    {
        Gate::authorize('download', $attachment);

        if (! Storage::disk($attachment->disk)->exists($attachment->path)) {
            abort(404, 'Attachment file not found on storage.');
        }

        // Audit download / file access
        AuditEvent::query()->create([
            'actor_id' => $request->user()->id,
            'subject_type' => Attachment::class,
            'subject_id' => $attachment->id,
            'action' => 'attachment.downloaded',
            'after_state' => [
                'owner_type' => $attachment->owner_type,
                'owner_id' => $attachment->owner_id,
                'original_filename' => $attachment->original_filename,
                'mime_type' => $attachment->mime_type,
                'size_bytes' => $attachment->size_bytes,
                'checksum_sha256' => $attachment->checksum_sha256,
            ],
            'request_id' => $request->header('X-Request-ID') ?? $request->ip(),
            'ip_address' => $request->ip(),
            'occurred_at' => now(),
        ]);

        return Storage::disk($attachment->disk)->download(
            $attachment->path,
            $attachment->original_filename,
            ['Content-Type' => $attachment->mime_type]
        );
    }
}
