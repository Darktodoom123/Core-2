<?php

namespace App\Shared\Assets\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Modules\Fleet\Models\AssetDocument;
use App\Shared\Assets\Models\OperationalAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class AssetDocumentApiController extends Controller
{
    public function index(Request $request, string $code): JsonResponse
    {
        $user = $request->user();

        $asset = OperationalAsset::where('code', $code)
            ->visibleTo($user)
            ->firstOrFail();

        $documents = AssetDocument::with('latestAttachment')
            ->where('operational_asset_id', $asset->id)
            ->get();

        $formatted = $documents->map(function ($doc) use ($asset) {
            $attachment = $doc->latestAttachment;

            return [
                'id' => (string) $doc->id,
                'category' => $doc->category,
                'title' => $doc->title ?? $doc->categoryLabel(),
                'documentNumber' => $doc->document_number,
                'issuingAuthority' => $doc->issuing_authority ?? 'Unknown',
                'issuedDate' => $doc->issued_at ? $doc->issued_at->toDateString() : 'N/A',
                'expiryDate' => $doc->expires_at ? $doc->expires_at->toDateString() : null,
                'isExpired' => $doc->isExpired(),
                'assetCode' => $asset->code,
                'status' => $doc->validityStatus(),
                'notes' => $doc->notes,
                'fileUri' => $attachment ? route('api.v1.fleet.assets.permits.download', ['operationalAsset' => $asset->id, 'document' => $doc->id]) : null,
                'fileSizeLabel' => $attachment ? round($attachment->size_bytes / 1024 / 1024, 1).' MB · '.strtoupper(pathinfo($attachment->path, PATHINFO_EXTENSION)) : null,
                'version' => $attachment ? $attachment->updated_at->timestamp : null,
            ];
        });

        return response()->json(['data' => $formatted]);
    }

    public function download(Request $request, OperationalAsset $operationalAsset, AssetDocument $document): Response
    {
        abort_unless($operationalAsset->id === $document->operational_asset_id, 404);

        // Ensure user can access asset
        $user = $request->user();
        $asset = OperationalAsset::where('id', $operationalAsset->id)->visibleTo($user)->first();
        abort_if(is_null($asset), 403, 'Unauthorized access to asset documents.');

        $attachment = $document->latestAttachment;
        abort_if(is_null($attachment), 404, 'Document file not found.');

        if (! Storage::disk($attachment->disk)->exists($attachment->path)) {
            abort(404, 'Attachment file not found on storage.');
        }

        return Storage::disk($attachment->disk)->response(
            $attachment->path,
            $attachment->original_filename,
            ['Content-Type' => $attachment->mime_type]
        );
    }
}
