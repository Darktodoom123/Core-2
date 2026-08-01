<?php

namespace App\Modules\Assignment\Actions;

use App\Modules\Dispatch\Models\ApprovalRequest;
use App\Modules\Dispatch\Models\DispatchJob;

final readonly class ReassignmentResult
{
    public function __construct(
        public DispatchJob $job,
        public ?ApprovalRequest $approval = null,
    ) {}

    public function approvalRequested(): bool
    {
        return $this->approval instanceof ApprovalRequest;
    }
}
