<?php

namespace App\Modules\Dvir\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;

/**
 * @property int $id
 * @property int $dvir_inspection_id
 * @property string $angle
 * @property string $storage_disk
 * @property string $file_path
 * @property string|null $file_name
 * @property int|null $file_size_bytes
 * @property string $mime_type
 * @property string|null $sha256_checksum
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 * @property-read string $url
 * @property-read DvirInspection $inspection
 */
class DvirInspectionPhoto extends Model
{
    protected $table = 'dvir_inspection_photos';

    protected $fillable = [
        'dvir_inspection_id',
        'angle',
        'storage_disk',
        'file_path',
        'file_name',
        'file_size_bytes',
        'mime_type',
        'sha256_checksum',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'dvir_inspection_id' => 'integer',
            'file_size_bytes' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<DvirInspection, $this>
     */
    public function inspection(): BelongsTo
    {
        return $this->belongsTo(DvirInspection::class, 'dvir_inspection_id');
    }

    /**
     * Accessible URL for the photo.
     *
     * @return Attribute<string, never>
     */
    protected function url(): Attribute
    {
        return Attribute::make(
            get: function (): string {
                if (str_starts_with($this->file_path, 'http://') || str_starts_with($this->file_path, 'https://') || str_starts_with($this->file_path, 'data:')) {
                    return $this->file_path;
                }

                $disk = $this->storage_disk ?: (string) config('filesystems.dvir_disk', 'public');

                return Storage::disk($disk)->url($this->file_path);
            },
        );
    }
}
