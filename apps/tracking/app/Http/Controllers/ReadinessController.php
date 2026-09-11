<?php

namespace Tracking\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Throwable;

final class ReadinessController extends Controller
{
    public function __invoke(): JsonResponse
    {
        $migrationTable = (string) config('database.migrations.table', 'migrations');
        $migrationFiles = glob(database_path('migrations/*.php')) ?: [];

        try {
            DB::connection()->getPdo();

            if (! Schema::hasTable($migrationTable)) {
                return $this->unready(count($migrationFiles), 0);
            }

            $appliedMigrations = DB::table($migrationTable)->pluck('migration')->map(
                static fn (mixed $migration): string => (string) $migration,
            )->all();
            $expectedMigrations = array_map(
                static fn (string $path): string => pathinfo($path, PATHINFO_FILENAME),
                $migrationFiles,
            );
            $pendingMigrations = array_diff($expectedMigrations, $appliedMigrations);

            if ($pendingMigrations !== []) {
                return $this->unready(count($expectedMigrations), count($appliedMigrations));
            }

            return response()->json([
                'status' => 'ready',
                'database' => 'ok',
                'migrations' => 'ok',
                'migrations_applied' => count($appliedMigrations),
            ]);
        } catch (Throwable) {
            return $this->unready(count($migrationFiles), 0);
        }
    }

    private function unready(int $expectedMigrations, int $appliedMigrations): JsonResponse
    {
        return response()->json([
            'status' => 'unready',
            'database' => 'unavailable',
            'migrations' => 'pending',
            'migrations_expected' => $expectedMigrations,
            'migrations_applied' => $appliedMigrations,
        ], 503);
    }
}
