<?php

namespace App\Platform\Identity\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Platform\Identity\Models\PersonnelCredential;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class PersonnelCredentialController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $credentials = PersonnelCredential::with('latestAttachment')
            ->where('user_id', $user->id)
            ->get();

        $formatted = $credentials->map(function ($cred) use ($user) {
            $attachment = $cred->latestAttachment;

            return [
                'id' => (string) $cred->id,
                'category' => 'operator_licenses',
                'title' => ucwords(str_replace('_', ' ', $cred->credential_type)),
                'documentNumber' => $cred->credential_number,
                'issuingAuthority' => $cred->issuing_authority ?? 'Unknown',
                'issuedDate' => $cred->issued_at ? $cred->issued_at->toDateString() : 'N/A',
                'expiryDate' => $cred->expires_at ? $cred->expires_at->toDateString() : null,
                'isExpired' => $cred->isExpired(),
                'operatorName' => $user->name,
                'status' => $cred->validityStatus(),
                'notes' => $cred->notes,
                'fileUri' => $attachment ? route('api.v1.personnel.credentials.download', $cred->id) : null,
                'fileSizeLabel' => $attachment ? round($attachment->size_bytes / 1024 / 1024, 1).' MB · '.strtoupper(pathinfo($attachment->path, PATHINFO_EXTENSION)) : null,
                'version' => $attachment ? $attachment->updated_at->timestamp : null,
            ];
        });

        return response()->json(['data' => $formatted]);
    }

    public function download(Request $request, PersonnelCredential $credential): Response
    {
        abort_unless($credential->user_id === $request->user()->id, 403);

        $attachment = $credential->latestAttachment;
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
