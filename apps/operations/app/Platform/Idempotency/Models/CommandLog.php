<?php

namespace App\Platform\Idempotency\Models;

use App\Platform\Identity\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommandLog extends Model
{
    protected $fillable = [
        'user_id',
        'command_id',
        'action_name',
        'payload_hash',
        'expected_version',
        'status',
        'response_code',
        'response_payload',
    ];

    protected function casts(): array
    {
        return [
            'expected_version' => 'integer',
            'response_code' => 'integer',
            'response_payload' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
