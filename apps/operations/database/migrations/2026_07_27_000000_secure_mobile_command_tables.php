<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /** @var list<string> */
    private array $tables = ['personal_access_tokens', 'command_logs'];

    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->tables as $table) {
            DB::statement(sprintf('alter table public.%s enable row level security', $table));
        }

        foreach (['anon', 'authenticated'] as $role) {
            $exists = DB::selectOne('select count(*) as aggregate from pg_roles where rolname = ?', [$role]);

            if ((int) ($exists->aggregate ?? 0) === 0) {
                continue;
            }

            foreach ($this->tables as $table) {
                DB::statement(sprintf('revoke all privileges on table public.%s from %s', $table, $role));
            }
        }
    }

    public function down(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        foreach ($this->tables as $table) {
            DB::statement(sprintf('alter table public.%s disable row level security', $table));
        }

        // Revoked Data API privileges remain revoked intentionally.
    }
};
