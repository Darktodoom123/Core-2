<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Attachment extends Model
{
    protected $fillable = ['owner_type', 'owner_id', 'uploaded_by', 'kind', 'disk', 'path', 'original_filename', 'mime_type', 'size_bytes', 'checksum_sha256', 'retention_until'];

    protected function casts(): array
    {
        return ['retention_until' => 'datetime'];
    }

    /** @return MorphTo<Model, $this> */
    public function owner(): MorphTo
    {
        return $this->morphTo();
    }

    /** @return BelongsTo<User, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
