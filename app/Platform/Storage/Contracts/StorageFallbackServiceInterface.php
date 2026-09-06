<?php

declare(strict_types=1);

namespace App\Platform\Storage\Contracts;

interface StorageFallbackServiceInterface
{
    /**
     * Determine whether the given storage disk has valid credentials and configuration.
     */
    public function isConfigured(string $disk): bool;

    /**
     * Resolve the disk to use, returning the desired disk if configured, or falling back
     * to the specified fallback disk with structured logging.
     */
    public function resolveDisk(string $desiredDisk, string $fallbackDisk): string;

    /**
     * Safely execute an operation against the desired disk, falling back if unconfigured
     * or if a network/cloud driver exception occurs during execution.
     *
     * @param  callable(string): mixed  $operation
     */
    public function safeExecute(string $desiredDisk, string $fallbackDisk, callable $operation): mixed;

    /**
     * Resolve the public media disk (e.g. 'r2-public'), falling back to 'public' if unconfigured.
     */
    public function resolvePublicDisk(?string $desired = null, string $fallback = 'public'): string;

    /**
     * Resolve the protected documents disk (e.g. 'r2-private'), falling back to 'private' if unconfigured.
     */
    public function resolveProtectedDisk(?string $desired = null, string $fallback = 'private'): string;
}
