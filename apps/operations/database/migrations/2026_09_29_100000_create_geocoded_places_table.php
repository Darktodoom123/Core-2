<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Address cache keyed by coordinates rounded to 5 decimals (~1 m).
        // Rows carry no user, asset, or incident reference.
        Schema::create('geocoded_places', function (Blueprint $table): void {
            $table->id();
            $table->string('coordinate_key', 32)->unique();
            $table->decimal('latitude', 8, 5);
            $table->decimal('longitude', 9, 5);
            $table->string('primary_name', 255)->nullable();
            $table->string('secondary_name', 500)->nullable();
            $table->string('provider', 32)->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamps();

            $table->index('updated_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('geocoded_places');
    }
};
