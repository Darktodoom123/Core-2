<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('push_deliveries', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('user_device_token_id')->nullable()->constrained('user_device_tokens')->nullOnDelete();
            $table->string('ticket_id', 128)->nullable()->index();
            $table->string('event', 64)->index();
            $table->string('relevance_type', 64)->nullable();
            $table->string('relevance_id', 64)->nullable();
            $table->string('deduplication_key', 255)->nullable()->index();
            $table->string('status', 32)->default('queued')->index();
            $table->string('provider', 32)->default('expo');
            $table->string('error_code', 64)->nullable();
            $table->text('error_message')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('sent_at')->nullable()->index();
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('opened_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'sent_at']);
            $table->index(['user_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('push_deliveries');
    }
};
