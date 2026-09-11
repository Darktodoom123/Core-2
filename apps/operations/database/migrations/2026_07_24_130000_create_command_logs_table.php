<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('command_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->uuid('command_id')->index();
            $table->string('action_name', 64)->index();
            $table->integer('expected_version')->nullable();
            $table->string('status', 24)->default('completed')->index();
            $table->integer('response_code')->default(200);
            $table->json('response_payload')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'command_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('command_logs');
    }
};
