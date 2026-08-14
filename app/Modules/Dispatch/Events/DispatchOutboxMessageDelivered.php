<?php

namespace App\Modules\Dispatch\Events;

use App\Modules\Dispatch\Models\DispatchOutboxMessage;
use Illuminate\Contracts\Events\ShouldDispatchAfterCommit;

final class DispatchOutboxMessageDelivered implements ShouldDispatchAfterCommit
{
    public function __construct(public readonly DispatchOutboxMessage $message) {}
}
