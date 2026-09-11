<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fuel_requests', function (Blueprint $table): void {
            $table->foreignId('operator_shift_id')
                ->nullable()
                ->after('operational_asset_id')
                ->constrained('operator_shifts')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('fuel_requests', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('operator_shift_id');
        });
    }
};
