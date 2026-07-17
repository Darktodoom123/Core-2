<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Inspection extends Model
{
    protected $fillable = ['operational_asset_id', 'technician_id', 'type', 'result', 'checklist', 'findings', 'completed_at'];

    protected function casts(): array
    {
        return ['checklist' => 'array', 'completed_at' => 'datetime'];
    }
}
