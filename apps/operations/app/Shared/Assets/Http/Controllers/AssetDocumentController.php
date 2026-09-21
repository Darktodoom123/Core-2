<?php

namespace App\Shared\Assets\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Fleet\Enums\AssetDocumentCategory;
use App\Modules\Fleet\Models\AssetDocument;
use App\Platform\Attachments\Actions\UploadAttachmentAction;
use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Enums\PermissionName;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

final class AssetDocumentController extends Controller
{
    public function store(Request $request, OperationalAsset $operationalAsset, UploadAttachmentAction $uploadAction, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetUpdateStatus : PermissionName::EquipmentUpdateStatus)->value);

        $validated = $request->validate([
            'category' => ['required', 'string', Rule::in(AssetDocumentCategory::values())],
            'title' => ['nullable', 'string', 'max:255'],
            'document_number' => ['nullable', 'string', 'max:96'],
            'issuing_authority' => ['nullable', 'string', 'max:128'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'file' => ['required', 'file', 'max:10240', 'mimetypes:application/pdf,image/jpeg,image/png,image/heic'],
        ]);

        $document = AssetDocument::query()->create([
            'operational_asset_id' => $operationalAsset->id,
            'category' => $validated['category'],
            'document_type' => $validated['document_type'] ?? $validated['category'],
            'title' => $validated['title'] ?? ucwords(str_replace('_', ' ', $validated['category'])),
            'document_number' => $validated['document_number'] ?? 'N/A',
            'issuing_authority' => $validated['issuing_authority'] ?? 'Self/Company',
            'issued_at' => $validated['issued_at'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'status' => 'active',
            'created_by' => $request->user()->id,
        ]);

        try {
            $attachment = $uploadAction->execute(
                uploader: $request->user(),
                owner: $document,
                file: $request->file('file'),
                kind: 'asset_document'
            );
        } catch (\Throwable $e) {
            $document->delete();
            throw $e;
        }

        $audit->handle($request->user(), $operationalAsset, 'asset.document_added', null, ['document_id' => $document->id, 'attachment_id' => $attachment->id]);

        if ($request->header('X-Inertia')) {
            return back()->with('status', 'Document added successfully.');
        }

        return response()->json(['data' => $document->load('latestAttachment')], 201);
    }

    public function update(Request $request, OperationalAsset $operationalAsset, AssetDocument $document, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetUpdateStatus : PermissionName::EquipmentUpdateStatus)->value);
        abort_unless($document->operational_asset_id === $operationalAsset->id, 404);

        $validated = $request->validate([
            'category' => ['sometimes', 'string', Rule::in(AssetDocumentCategory::values())],
            'title' => ['sometimes', 'string', 'max:255'],
            'document_number' => ['nullable', 'string', 'max:96'],
            'issuing_authority' => ['nullable', 'string', 'max:128'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', 'in:active,revoked,superseded'],
        ]);

        $before = $document->toArray();
        $document->update($validated);
        $document->updated_by = $request->user()->id;
        $document->save();

        $audit->handle($request->user(), $operationalAsset, 'asset.document_updated', $before, $document->fresh()->toArray());

        if ($request->header('X-Inertia')) {
            return back()->with('status', 'Document updated successfully.');
        }

        return response()->json(['data' => $document->fresh()->load('latestAttachment')]);
    }

    public function replace(Request $request, OperationalAsset $operationalAsset, AssetDocument $document, UploadAttachmentAction $uploadAction, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetUpdateStatus : PermissionName::EquipmentUpdateStatus)->value);
        abort_unless($document->operational_asset_id === $operationalAsset->id, 404);

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:10240', 'mimetypes:application/pdf,image/jpeg,image/png,image/heic'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'expires_at' => ['nullable', 'date'],
        ]);

        if (array_key_exists('notes', $validated)) {
            $document->notes = $validated['notes'];
        }
        if (array_key_exists('expires_at', $validated)) {
            $document->expires_at = $validated['expires_at'];
        }
        $document->updated_by = $request->user()->id;
        $document->save();

        $attachment = $uploadAction->execute(
            uploader: $request->user(),
            owner: $document,
            file: $request->file('file'),
            kind: 'asset_document'
        );

        // Safely remove older attachments belonging only to this document
        $document->attachments()->where('id', '!=', $attachment->id)->each(function ($old): void {
            if (Storage::disk($old->disk)->exists($old->path)) {
                Storage::disk($old->disk)->delete($old->path);
            }
            $old->delete();
        });

        $audit->handle($request->user(), $operationalAsset, 'asset.document_replaced', null, [
            'document_id' => $document->id,
            'attachment_id' => $attachment->id,
        ]);

        if ($request->header('X-Inertia')) {
            return back()->with('status', 'Document replaced successfully.');
        }

        return response()->json(['data' => $document->fresh()->load('latestAttachment')]);
    }

    public function destroy(Request $request, OperationalAsset $operationalAsset, AssetDocument $document, RecordAuditEvent $audit): JsonResponse|RedirectResponse
    {
        $isFleet = in_array($operationalAsset->kind, ['truck', 'vehicle'], true);
        Gate::authorize(($isFleet ? PermissionName::FleetUpdateStatus : PermissionName::EquipmentUpdateStatus)->value);
        abort_unless($document->operational_asset_id === $operationalAsset->id, 404);

        $docData = $document->toArray();

        // Safely remove only attachments belonging to this record
        $document->attachments()->each(function ($attachment): void {
            if (Storage::disk($attachment->disk)->exists($attachment->path)) {
                Storage::disk($attachment->disk)->delete($attachment->path);
            }
            $attachment->delete();
        });

        $document->delete();

        $audit->handle($request->user(), $operationalAsset, 'asset.document_removed', $docData, null);

        if ($request->header('X-Inertia')) {
            return back()->with('status', 'Document removed successfully.');
        }

        return response()->json(['message' => 'Document removed successfully.']);
    }
}
