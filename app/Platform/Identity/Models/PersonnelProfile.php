<?php

namespace App\Platform\Identity\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PersonnelProfile extends Model
{
    protected $fillable = ['user_id', 'employee_number', 'availability_status', 'emergency_contact_name', 'emergency_contact_phone'];

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
