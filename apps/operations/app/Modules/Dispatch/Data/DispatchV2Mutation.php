<?php

namespace App\Modules\Dispatch\Data;

use App\Modules\Dispatch\Enums\DispatchV2CommandCode;
use App\Modules\Dispatch\Exceptions\DispatchV2CommandException;
use App\Platform\Identity\Models\User;

final readonly class DispatchV2Mutation
{
    /**
     * @param  array<string, mixed>  $payload
     */
    public function __construct(
        public int $expectedVersion,
        public ?string $idempotencyKey = null,
        public string $workspaceKey = 'operations',
        public ?string $reason = null,
        public array $payload = [],
        public string $idempotencyOwnerType = User::class,
        public ?int $idempotencyOwnerId = null,
    ) {
        if ($this->expectedVersion < 1) {
            throw new DispatchV2CommandException(
                DispatchV2CommandCode::MissingExpectedVersion,
                'An expected version is required for this operation.',
                status: 422,
            );
        }

        if ($this->workspaceKey === '' || strlen($this->workspaceKey) > 64) {
            throw new DispatchV2CommandException(
                DispatchV2CommandCode::InvalidCommand,
                'The dispatch scope is invalid.',
                status: 422,
            );
        }

        if ($this->idempotencyKey !== null && (trim($this->idempotencyKey) === '' || strlen($this->idempotencyKey) > 128)) {
            throw new DispatchV2CommandException(
                DispatchV2CommandCode::InvalidCommand,
                'The idempotency key is invalid.',
                status: 422,
            );
        }

        if ($this->idempotencyOwnerType === '' || strlen($this->idempotencyOwnerType) > 64 || ($this->idempotencyOwnerId !== null && $this->idempotencyOwnerId < 1)) {
            throw new DispatchV2CommandException(
                DispatchV2CommandCode::InvalidCommand,
                'The idempotency owner is invalid.',
                status: 422,
            );
        }
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    public static function forVersion(
        int $expectedVersion,
        ?string $idempotencyKey = null,
        string $workspaceKey = 'operations',
        ?string $reason = null,
        array $payload = [],
        string $idempotencyOwnerType = User::class,
        ?int $idempotencyOwnerId = null,
    ): self {
        return new self($expectedVersion, $idempotencyKey, $workspaceKey, $reason, $payload, $idempotencyOwnerType, $idempotencyOwnerId);
    }

    /** @param  array<string, mixed>  $payload */
    public static function forOwner(
        int $expectedVersion,
        string $idempotencyKey,
        string $ownerType,
        int $ownerId,
        string $workspaceKey = 'operations',
        ?string $reason = null,
        array $payload = [],
    ): self {
        return new self($expectedVersion, $idempotencyKey, $workspaceKey, $reason, $payload, $ownerType, $ownerId);
    }

    public function payloadHash(string $action, int $aggregateId): string
    {
        return hash('sha256', (string) json_encode([
            'action' => $action,
            'aggregate_id' => $aggregateId,
            'expected_version' => $this->expectedVersion,
            'workspace_key' => $this->workspaceKey,
            'reason' => $this->reason,
            'payload' => self::canonicalize($this->payload),
            'owner_type' => $this->idempotencyOwnerType,
            'owner_id' => $this->idempotencyOwnerId,
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    private static function canonicalize(mixed $value): mixed
    {
        if (! is_array($value)) {
            return $value;
        }

        $normalized = [];
        foreach ($value as $key => $child) {
            $normalized[$key] = self::canonicalize($child);
        }

        if (array_keys($normalized) !== range(0, count($normalized) - 1)) {
            ksort($normalized);
        }

        return $normalized;
    }
}
