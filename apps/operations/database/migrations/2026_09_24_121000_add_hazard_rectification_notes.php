<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('site_hazard_tickets', function (Blueprint $table): void {
            $table->text('rectification_notes')->nullable();
            $table->decimal('location_latitude', 10, 7)->nullable();
            $table->decimal('location_longitude', 10, 7)->nullable();
            $table->decimal('location_accuracy_metres', 8, 2)->nullable();
            $table->timestamp('location_observed_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('site_hazard_tickets', function (Blueprint $table): void {
            $table->dropColumn([
                'rectification_notes',
                'location_latitude',
                'location_longitude',
                'location_accuracy_metres',
                'location_observed_at',
            ]);
        });
    }
};
