<?php

declare(strict_types=1);

namespace App\Platform\Storage\Facades;

use App\Platform\Storage\Contracts\StorageFallbackServiceInterface;
use App\Platform\Storage\Services\StorageFallbackService;
use Illuminate\Support\Facades\Facade;

/**
 * @method static bool isConfigured(string $disk)
 * @method static string resolveDisk(string $desiredDisk, string $fallbackDisk)
 * @method static mixed safeExecute(string $desiredDisk, string $fallbackDisk, callable $operation)
 * @method static string resolvePublicDisk(?string $desired = null, string $fallback = 'public')
 * @method static string resolveProtectedDisk(?string $desired = null, string $fallback = 'private')
 *
 * @see StorageFallbackService
 */
final class StorageFallback extends Facade
{
    protected static function getFacadeAccessor(): string
    {
        return StorageFallbackServiceInterface::class;
    }
}
