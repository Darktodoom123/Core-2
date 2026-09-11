<?php

namespace App\Platform\Identity\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['user_id', 'employee_number', 'availability_status', 'emergency_contact_name', 'emergency_contact_phone'])]
#[Hidden(['emergency_contact_name', 'emergency_contact_phone'])]
class PersonnelProfile extends Model
{
    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
