<?php

namespace App\Modules\Dvir\Http\Resources\V1;

use App\Modules\Dvir\Models\DvirInspectionPhoto;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin DvirInspectionPhoto
 */
class DvirInspectionPhotoResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->getKey(),
            'angle' => $this->angle,
            'file_name' => $this->file_name,
            'file_size_bytes' => $this->file_size_bytes,
            'mime_type' => $this->mime_type,
            'storage_disk' => $this->storage_disk,
            'sha256_checksum' => $this->sha256_checksum,
            'url' => $this->url,
            'created_at' => $this->created_at?->toIso8601String(),
        ];
    }
}
