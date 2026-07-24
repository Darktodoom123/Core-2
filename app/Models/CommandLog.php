<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CommandLog extends Model
{
    protected $fillable = [
        'user_id',
        'command_id',
        'action_name',
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
