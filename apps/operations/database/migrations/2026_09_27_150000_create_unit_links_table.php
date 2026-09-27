<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Which operator is physically bound to which unit, from link to release.
        Schema::create('unit_links', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('operational_asset_id')->constrained('operational_assets')->restrictOnDelete();
            $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
            $table->foreignId('dispatch_job_id')->nullable()->constrained('dispatch_jobs')->nullOnDelete();
            $table->timestamp('linked_at');
            $table->timestamp('released_at')->nullable();
            $table->string('release_reason', 40)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'released_at']);
            $table->index(['operational_asset_id', 'released_at']);
        });

        if (in_array(DB::getDriverName(), ['sqlite', 'pgsql'], true)) {
            // One open link per unit and per operator, even under concurrent requests.
            DB::statement('CREATE UNIQUE INDEX unique_open_unit_link_per_asset ON unit_links (operational_asset_id) WHERE released_at IS NULL');
            DB::statement('CREATE UNIQUE INDEX unique_open_unit_link_per_user ON unit_links (user_id) WHERE released_at IS NULL');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('unit_links');
    }
};
