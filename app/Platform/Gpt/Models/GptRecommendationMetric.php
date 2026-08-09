<?php

namespace App\Platform\Gpt\Models;

use Illuminate\Database\Eloquent\Model;

final class GptRecommendationMetric extends Model
{
    protected $fillable = [
        'recommendation_id',
        'event',
        'status',
        'latency_ms',
        'prompt_tokens',
        'completion_tokens',
        'total_tokens',
        'cost_usd',
        'occurred_at',
        'purge_at',
    ];

    protected function casts(): array
    {
        return [
            'latency_ms' => 'integer',
            'prompt_tokens' => 'integer',
            'completion_tokens' => 'integer',
            'total_tokens' => 'integer',
            'cost_usd' => 'decimal:4',
            'occurred_at' => 'datetime',
            'purge_at' => 'datetime',
        ];
    }
}
