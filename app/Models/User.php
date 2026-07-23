<?php

namespace App\Models;

use App\Enums\RoleName;
use Database\Factories\UserFactory;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Spatie\Permission\Traits\HasRoles;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'phone', 'password', 'is_active', 'suspended_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable implements MustVerifyEmail
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, HasRoles, Notifiable;

    protected string $guard_name = 'web';

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'is_active' => 'boolean',
            'password' => 'hashed',
            'suspended_at' => 'datetime',
        ];
    }

    public function operationalRole(): ?RoleName
    {
        $name = $this->getRoleNames()->first();

        return is_string($name) ? RoleName::tryFrom($name) : null;
    }

    /** @return HasOne<PersonnelProfile, $this> */
    public function personnelProfile(): HasOne
    {
        return $this->hasOne(PersonnelProfile::class);
    }

    /** @return HasMany<PersonnelCredential, $this> */
    public function personnelCredentials(): HasMany
    {
        return $this->hasMany(PersonnelCredential::class);
    }

    /** @return HasMany<DispatchPersonnelAssignment, $this> */
    public function dispatchAssignments(): HasMany
    {
        return $this->hasMany(DispatchPersonnelAssignment::class);
    }
}
