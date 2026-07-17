<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class GptRecommendation extends Model
{
    protected $fillable = ['subject_type', 'subject_id', 'requested_by', 'purpose', 'context_hash', 'input_references', 'recommendation', 'conflicts', 'model', 'status', 'decided_by', 'decided_at'];

    protected function casts(): array
    {
        return ['input_references' => 'array', 'recommendation' => 'array', 'conflicts' => 'array', 'decided_at' => 'datetime'];
    }

    /** @return MorphTo<Model, $this> */
    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
