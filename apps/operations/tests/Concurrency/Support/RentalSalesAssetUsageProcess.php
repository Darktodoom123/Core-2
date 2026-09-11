<?php

declare(strict_types=1);

namespace Tests\Concurrency\Support;

final class RentalSalesAssetUsageProcess
{
    /**
     * @param  list<string>  $arguments
     * @return array{process: resource, pipes: array<int, resource>}
     */
    public static function start(string $script, array $arguments = []): array
    {
        $command = [PHP_BINARY, $script, ...$arguments];
        $specification = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];
        $pipes = [];
        $process = proc_open($command, $specification, $pipes);

        if (! is_resource($process)) {
            throw new \RuntimeException('Unable to start the Rental/Sales concurrency worker.');
        }

        return ['process' => $process, 'pipes' => $pipes];
    }
}
