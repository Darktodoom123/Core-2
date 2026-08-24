<?php

namespace App\Platform\Safety\Models;

use Database\Factories\SosEmergencyContactFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

final class SosEmergencyContact extends Model
{
    /** @use HasFactory<SosEmergencyContactFactory> */
    use HasFactory;

    protected static function newFactory(): SosEmergencyContactFactory
    {
        return SosEmergencyContactFactory::new();
    }

    protected $fillable = ['name', 'role_label', 'phone_e164', 'phone_hash', 'escalation_order', 'is_active'];

    protected function casts(): array
    {
        return [
            'phone_e164' => 'encrypted',
            'is_active' => 'boolean',
            'escalation_order' => 'integer',
        ];
    }

    /** @param Builder<SosEmergencyContact> $query
     * @return Builder<SosEmergencyContact>
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true)->orderBy('escalation_order')->orderBy('id');
    }
}
