<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('location_updates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('latitude', 10, 7);
            $table->decimal('longitude', 10, 7);
            $table->decimal('accuracy_metres', 8, 2)->nullable();
            $table->string('source', 24)->default('mobile');
            $table->boolean('sharing_enabled')->default(true);
            $table->timestamp('captured_at')->index();
            $table->timestamp('received_at')->index();
            $table->timestamps();
            $table->index(['user_id', 'captured_at']);
        });

        Schema::create('gpt_recommendations', function (Blueprint $table): void {
            $table->id();
            $table->nullableMorphs('subject');
            $table->foreignId('requested_by')->constrained('users')->restrictOnDelete();
            $table->string('purpose', 48)->index();
            $table->string('context_hash', 64);
            $table->json('input_references');
            $table->json('recommendation');
            $table->json('conflicts')->nullable();
            $table->string('model', 64);
            $table->string('status', 24)->default('draft')->index();
            $table->foreignId('decided_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('decided_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gpt_recommendations');
        Schema::dropIfExists('location_updates');
    }
};
