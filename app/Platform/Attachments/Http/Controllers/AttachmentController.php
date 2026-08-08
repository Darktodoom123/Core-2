<?php

namespace App\Platform\Attachments\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Attachments\Actions\UploadAttachmentAction;
use App\Platform\Attachments\Http\Requests\UploadAttachmentRequest;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Attachments\Services\AttachmentOwnerResolver;
use App\Platform\Audit\Models\AuditEvent;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    public function store(UploadAttachmentRequest $request, UploadAttachmentAction $action, AttachmentOwnerResolver $owners): RedirectResponse|JsonResponse
    {
        $ownerType = $request->input('owner_type');
        $ownerId = (int) $request->input('owner_id');

        $owner = $owners->resolve((string) $ownerType, $ownerId);
        Gate::forUser($request->user())->authorize('view', $owner);

        $retentionUntil = $request->input('retention_until')
            ? Carbon::parse($request->input('retention_until'))
            : null;

        try {
            $attachment = $action->execute(
                $request->user(),
                $owner,
                $request->file('file'),
                $request->input('kind', 'document'),
                $retentionUntil,
            );
        } catch (InvalidArgumentException $exception) {
            throw ValidationException::withMessages([
                'file' => $exception->getMessage(),
            ]);
        }

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

        $requestId = $request->header('X-Request-ID');
        if (! is_string($requestId) || ! Str::isUuid($requestId)) {
            $requestId = (string) Str::uuid();
        }

        // Audit download / file access
        AuditEvent::query()->create([
            'actor_id' => $request->user()->id,
            'subject_type' => $attachment->getMorphClass(),
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
            'request_id' => $requestId,
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
