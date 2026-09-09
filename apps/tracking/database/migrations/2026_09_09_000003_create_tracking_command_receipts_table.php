<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tracking_command_receipts', function (Blueprint $table): void {
            $table->id();
            $table->string('command_id', 64)->unique();
            $table->string('action', 50)->default('telemetry.ingest');
            $table->string('payload_hash', 64)->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('location_sample_id')->nullable();
            $table->unsignedSmallInteger('status_code')->default(201);
            $table->json('response_payload')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamps();

            $table->index('location_sample_id');
            $table->index('user_id');
            $table->index('payload_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tracking_command_receipts');
    }
};
