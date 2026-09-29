<?php

namespace App\Platform\Gpt\Actions;

use App\Platform\Audit\Actions\RecordAuditEvent;
use App\Platform\Identity\Models\User;
use Illuminate\Support\Facades\Cache;

/**
 * Pauses or resumes all GPT advice. Setting the state it already has is a
 * no-op, so a retried or doubled request never adds a second audit record.
 */
final class SetGptCircuitBreaker
{
    public const CACHE_KEY = 'gpt_circuit_breaker_disabled';

    private const LOCK_SECONDS = 5;

    public function __construct(private RecordAuditEvent $audit) {}

    public static function isPaused(): bool
    {
        return (bool) Cache::get(self::CACHE_KEY, false);
    }

    public function handle(User $actor, bool $paused, ?string $reason = null): bool
    {
        return Cache::lock(self::CACHE_KEY.':lock', self::LOCK_SECONDS)->block(self::LOCK_SECONDS, function () use ($actor, $paused, $reason): bool {
            $current = self::isPaused();

            if ($current === $paused) {
                return $paused;
            }

            Cache::forever(self::CACHE_KEY, $paused);
            $this->audit->handle(
                $actor,
                $actor,
                $paused ? 'gpt.circuit_breaker_paused' : 'gpt.circuit_breaker_resumed',
                ['paused' => $current],
                ['paused' => $paused],
                $reason,
            );

            return $paused;
        });
    }
}
