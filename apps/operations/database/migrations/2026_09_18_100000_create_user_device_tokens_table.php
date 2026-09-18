<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_device_tokens', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('installation_id', 128)->index();
            $table->string('token', 512)->index();
            $table->string('platform', 32)->default('android');
            $table->string('provider', 32)->default('expo');
            $table->string('app_version', 32)->nullable();
            $table->boolean('is_active')->default(true)->index();
            $table->timestamp('last_registered_at')->nullable();
            $table->timestamp('last_used_at')->nullable();
            $table->timestamp('revoked_at')->nullable()->index();
            $table->timestamps();

            $table->index(['user_id', 'is_active']);
            $table->unique(['user_id', 'installation_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_device_tokens');
    }
};
