<?php

namespace App\Shared\Assets\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Carbon;

/** @property Carbon|null $completed_at */
class Inspection extends Model
{
    protected $fillable = ['operational_asset_id', 'technician_id', 'type', 'result', 'checklist', 'findings', 'completed_at'];

    protected function casts(): array
    {
        return ['checklist' => 'array', 'completed_at' => 'datetime'];
    }
}
