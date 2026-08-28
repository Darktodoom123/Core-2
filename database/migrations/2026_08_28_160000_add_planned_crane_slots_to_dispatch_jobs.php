<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->json('planned_crane_slots')->nullable()->after('site_longitude');
        });
    }

    public function down(): void
    {
        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->dropColumn('planned_crane_slots');
        });
    }
};
