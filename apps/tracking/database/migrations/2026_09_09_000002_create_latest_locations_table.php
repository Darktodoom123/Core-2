<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('latest_locations', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->unique();
            $table->unsignedBigInteger('operational_asset_id')->nullable();
            $table->unsignedBigInteger('dispatch_job_id')->nullable();
            $table->unsignedBigInteger('location_sample_id')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->decimal('accuracy_metres', 8, 2)->nullable();
            $table->decimal('speed', 8, 2)->nullable();
            $table->string('remarks', 500)->nullable();
            $table->string('source', 50)->default('mobile');
            $table->boolean('sharing_enabled')->default(true);
            $table->string('command_id', 64)->nullable();
            $table->timestamp('captured_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();

            // Unconstrained scalar integer IDs with b-tree indexes (no foreign keys to Operations)
            $table->index('operational_asset_id');
            $table->index('dispatch_job_id');
            $table->index('location_sample_id');
            $table->index('captured_at');
            $table->index('received_at');
            $table->index(['operational_asset_id', 'captured_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('latest_locations');
    }
};
