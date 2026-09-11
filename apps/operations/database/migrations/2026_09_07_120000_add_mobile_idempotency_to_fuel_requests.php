<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fuel_requests', function (Blueprint $table): void {
            $table->uuid('client_request_id')->nullable();
            $table->string('client_payload_hash', 64)->nullable();
            $table->unique(['requester_id', 'client_request_id']);
        });
    }

    public function down(): void
    {
        Schema::table('fuel_requests', function (Blueprint $table): void {
            $table->dropUnique(['requester_id', 'client_request_id']);
            $table->dropColumn(['client_request_id', 'client_payload_hash']);
        });
    }
};
