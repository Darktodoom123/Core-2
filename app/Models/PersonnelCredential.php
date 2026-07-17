<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PersonnelCredential extends Model
{
    protected $fillable = ['user_id', 'kind', 'credential_number', 'credential_type', 'issued_at', 'expires_at', 'status', 'verified_by', 'verified_at'];

    protected function casts(): array
    {
        return ['issued_at' => 'date', 'expires_at' => 'date', 'verified_at' => 'datetime'];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return BelongsTo<User, $this> */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /**
     * @param  Builder<PersonnelCredential>  $query
     * @return Builder<PersonnelCredential>
     */
    public function scopeValidAt(Builder $query, CarbonInterface $at): Builder
    {
        return $query->where('status', 'active')
            ->where(fn (Builder $credentials): Builder => $credentials
                ->whereNull('issued_at')->orWhere('issued_at', '<=', $at->toDateString()))
            ->where(fn (Builder $credentials): Builder => $credentials
                ->whereNull('expires_at')->orWhere('expires_at', '>=', $at->toDateString()));
    }
}
