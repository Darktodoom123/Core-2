<?php

namespace App\Modules\Dispatch\Exceptions;

use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use RuntimeException;

final class DispatchV2CommandException extends RuntimeException
{
    /**
     * @param  array<string, mixed>  $details
     */
    public function __construct(
        public readonly DispatchV2CommandCode $commandCode,
        string $message,
        public readonly array $details = [],
        public readonly int $status = 409,
    ) {
        parent::__construct($message);
    }

    /**
     * @return array{error: string, message: string, details: array<string, mixed>}
     */
    public function toArray(): array
    {
        return [
            'error' => $this->commandCode->value,
            'message' => $this->getMessage(),
            'details' => $this->details,
        ];
    }

    public function getErrorCode(): DispatchV2CommandCode
    {
        return $this->commandCode;
    }
}
