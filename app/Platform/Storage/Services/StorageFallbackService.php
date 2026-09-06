<?php

declare(strict_types=1);

namespace App\Platform\Storage\Services;

use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use Closure;
use Illuminate\Contracts\Config\Repository;
use Illuminate\Contracts\Filesystem\Factory;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Filesystem\FilesystemManager;
use League\Flysystem\Local\LocalFilesystemAdapter;
use Psr\Log\LoggerInterface;
use Throwable;

final class StorageFallbackService implements StorageFallbackServiceInterface
{
    public function __construct(
        private readonly Repository $config,
        private readonly LoggerInterface $logger,
        private readonly ?Factory $filesystem = null,
    ) {}

    /**
     * Determine whether the given storage disk has valid credentials and configuration.
     */
    public function isConfigured(string $disk): bool
    {
        // If the disk was faked for testing, recognize it as configured and operational.
        if ($this->isFakedDisk($disk)) {
            return true;
        }

        /** @var array<string, mixed>|null $diskConfig */
        $diskConfig = $this->config->get("filesystems.disks.{$disk}");

        if (! is_array($diskConfig) || empty($diskConfig['driver'])) {
            return false;
        }

        $driver = (string) $diskConfig['driver'];

        if ($driver === 'local') {
            return ! empty($diskConfig['root']);
        }

        if ($driver === 's3') {
            return $this->isConfiguredS3($disk, $diskConfig);
        }

        return true;
    }

    /**
     * Resolve the disk to use, returning the desired disk if configured, or falling back
     * to the specified fallback disk with structured logging.
     */
    public function resolveDisk(string $desiredDisk, string $fallbackDisk): string
    {
        if ($this->isConfigured($desiredDisk)) {
            return $desiredDisk;
        }

        $this->logger->info(
            "Storage disk [{$desiredDisk}] is unconfigured; falling back to [{$fallbackDisk}].",
            [
                'desired_disk' => $desiredDisk,
                'fallback_disk' => $fallbackDisk,
            ]
        );

        return $fallbackDisk;
    }

    /**
     * Safely execute an operation against the desired disk, falling back if unconfigured
     * or if a network/cloud driver exception occurs during execution.
     *
     * @param  callable(string): mixed  $operation
     */
    public function safeExecute(string $desiredDisk, string $fallbackDisk, callable $operation): mixed
    {
        if (! $this->isConfigured($desiredDisk)) {
            $targetDisk = $this->resolveDisk($desiredDisk, $fallbackDisk);

            return $operation($targetDisk);
        }

        try {
            return $operation($desiredDisk);
        } catch (Throwable $e) {
            if ($desiredDisk === $fallbackDisk) {
                throw $e;
            }

            $this->logger->warning(
                "Storage disk [{$desiredDisk}] unreachable or operation failed ({$e->getMessage()}); falling back to [{$fallbackDisk}].",
                [
                    'desired_disk' => $desiredDisk,
                    'fallback_disk' => $fallbackDisk,
                    'exception' => $e::class,
                    'message' => $e->getMessage(),
                ]
            );

            return $operation($fallbackDisk);
        }
    }

    /**
     * Resolve the public media disk (e.g. 'r2-public'), falling back to 'public' if unconfigured.
     */
    public function resolvePublicDisk(?string $desired = null, string $fallback = 'public'): string
    {
        $desiredDisk = $desired ?? (string) $this->config->get('filesystems.dvir_disk', 'r2-public');

        return $this->resolveDisk($desiredDisk, $fallback);
    }

    /**
     * Resolve the protected documents disk (e.g. 'r2-private'), falling back to 'private' if unconfigured.
     */
    public function resolveProtectedDisk(?string $desired = null, string $fallback = 'private'): string
    {
        $desiredDisk = $desired ?? (string) $this->config->get('filesystems.protected_disk', 'r2-private');

        return $this->resolveDisk($desiredDisk, $fallback);
    }

    /**
     * Check if a disk was faked via Storage::fake() during testing.
     */
    private function isFakedDisk(string $disk): bool
    {
        if (! ($this->filesystem instanceof FilesystemManager)) {
            return false;
        }

        $checkClosure = Closure::bind(
            function (string $name): bool {
                if (! isset($this->disks[$name])) {
                    return false;
                }

                $resolvedDisk = $this->disks[$name];

                return $resolvedDisk instanceof FilesystemAdapter
                    && $resolvedDisk->getAdapter() instanceof LocalFilesystemAdapter;
            },
            $this->filesystem,
            FilesystemManager::class
        );

        return $checkClosure !== null && $checkClosure($disk);
    }

    /**
     * Determine if an S3/R2 disk configuration has complete credentials and endpoint.
     *
     * @param  array<string, mixed>  $config
     */
    private function isConfiguredS3(string $disk, array $config): bool
    {
        $key = $config['key'] ?? null;
        $secret = $config['secret'] ?? null;
        $bucket = $config['bucket'] ?? null;

        if (! is_string($key) || trim($key) === '') {
            return false;
        }

        if (! is_string($secret) || trim($secret) === '') {
            return false;
        }

        if (! is_string($bucket) || trim($bucket) === '') {
            return false;
        }

        // Cloudflare R2 disks or disks declaring an endpoint require a valid endpoint URL.
        if (str_contains($disk, 'r2') || array_key_exists('endpoint', $config)) {
            $endpoint = $config['endpoint'] ?? null;
            if (! is_string($endpoint) || trim($endpoint) === '') {
                return false;
            }
        }

        return true;
    }
}
