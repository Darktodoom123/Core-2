<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE audit_events ALTER COLUMN subject_id TYPE VARCHAR(64) USING subject_id::varchar');
        } else {
            Schema::table('audit_events', function (Blueprint $table): void {
                $table->string('subject_id', 64)->nullable()->change();
            });
        }
    }

    public function down(): void
    {
        $driver = DB::getDriverName();

        if ($driver === 'pgsql') {
            DB::statement('ALTER TABLE audit_events ALTER COLUMN subject_id TYPE BIGINT USING subject_id::bigint');
        } else {
            Schema::table('audit_events', function (Blueprint $table): void {
                $table->unsignedBigInteger('subject_id')->nullable()->change();
            });
        }
    }
};
