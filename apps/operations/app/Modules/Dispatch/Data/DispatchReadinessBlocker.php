<?php

namespace App\Modules\Dispatch\Data;

use App\Modules\Dispatch\Enums\DispatchReadinessBlockerCode;
use App\Modules\Dispatch\Enums\DispatchReadinessSeverity;

final readonly class DispatchReadinessBlocker
{
    /**
     * @param  array<string, mixed>  $evidence
     */
    public function __construct(
        public DispatchReadinessBlockerCode $code,
        public DispatchReadinessSeverity $severity,
        public string $messageKey,
        public array $evidence,
        public ?int $planVersion,
        public int $attemptVersion,
    ) {}

    /**
     * @return array{code: string, severity: string, message_key: string, evidence: array<string, mixed>, plan_version: int|null, attempt_version: int}
     */
    public function toArray(): array
    {
        return [
            'code' => $this->code->value,
            'severity' => $this->severity->value,
            'message_key' => $this->messageKey,
            'evidence' => $this->evidence,
            'plan_version' => $this->planVersion,
            'attempt_version' => $this->attemptVersion,
        ];
    }
}
