<?php

namespace App\Actions;

use App\Models\ApprovalRequest;
use App\Models\DispatchJob;

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
