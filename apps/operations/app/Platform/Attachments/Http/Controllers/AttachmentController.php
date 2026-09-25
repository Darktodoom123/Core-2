<?php

namespace App\Platform\Attachments\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Platform\Attachments\Actions\UploadAttachmentAction;
use App\Platform\Attachments\Http\Requests\UploadAttachmentRequest;
use App\Platform\Attachments\Models\Attachment;
use App\Platform\Attachments\Services\AttachmentOwnerResolver;
use App\Platform\Audit\Models\AuditEvent;
use App\Platform\Idempotency\Services\IdempotentCommandService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AttachmentController extends Controller
{
    public function store(UploadAttachmentRequest $request, UploadAttachmentAction $action, AttachmentOwnerResolver $owners, IdempotentCommandService $idempotency): RedirectResponse|JsonResponse
    {
        $ownerType = $request->input('owner_type');
        $ownerId = (int) $request->input('owner_id');

        $owner = $owners->resolve((string) $ownerType, $ownerId);
        Gate::forUser($request->user())->authorize('view', $owner);

        $upload = function () use ($request, $action, $owner): Attachment {
            try {
                return $action->execute(
                    $request->user(),
                    $owner,
                    $request->file('file'),
                    $request->input('kind', 'document'),
                    null,
                );
            } catch (InvalidArgumentException $exception) {
                throw ValidationException::withMessages([
                    'file' => $exception->getMessage(),
                ]);
            }
        };

        if ($request->wantsJson()) {
            $isApi = $request->is('api/*');
            $commandId = $idempotency->resolveCommandId($request, required: $isApi);

            if ($commandId !== null) {
                $file = $request->file('file');
                $fileHash = hash_file('sha256', (string) $file->getRealPath());
                $response = $idempotency->process(
                    $request->user(),
                    $commandId,
                    'attachments.upload',
                    null,
                    fn (): JsonResponse => response()->json([
                        'data' => $this->attachmentData($upload(), $isApi),
                    ], 201),
                    [
                        'owner_type' => $owner->getMorphClass(),
                        'owner_id' => $owner->getKey(),
                        'kind' => $request->input('kind', 'document'),
                        'file_sha256' => $fileHash,
                    ],
                    wrapInTransaction: false,
                );

                if (! $response instanceof JsonResponse) {
                    throw new \LogicException('Attachment uploads must return JSON.');
                }

                return $response;
            }

            return response()->json(['data' => $this->attachmentData($upload(), $isApi)], 201);
        }

        $upload();

        return redirect()->back()->with('flash', [
            'type' => 'success',
            'message' => 'Attachment uploaded successfully.',
        ]);
    }

    /** @return array<string, mixed> */
    private function attachmentData(Attachment $attachment, bool $api): array
    {
        return [
            'id' => $attachment->id,
            'owner_type' => $attachment->owner_type,
            'owner_id' => $attachment->owner_id,
            'kind' => $attachment->kind,
            'original_filename' => $attachment->original_filename,
            'mime_type' => $attachment->mime_type,
            'size_bytes' => $attachment->size_bytes,
            'download_url' => $api
                ? url("/api/v1/attachments/{$attachment->id}/download")
                : url("/operations/attachments/{$attachment->id}/download"),
        ];
    }

    public function download(Attachment $attachment, Request $request): StreamedResponse|RedirectResponse
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

        if ($request->boolean('temporary_url')) {
            try {
                $url = Storage::disk($attachment->disk)->temporaryUrl($attachment->path, now()->addMinutes(15));

                return redirect()->away($url);
            } catch (\Throwable) {
                // Fallback to streaming download
            }
        }

        return Storage::disk($attachment->disk)->download(
            $attachment->path,
            $attachment->original_filename,
            ['Content-Type' => $attachment->mime_type]
        );
    }
}
