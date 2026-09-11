<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('gpt_recommendation_metrics', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('recommendation_id')->constrained('gpt_recommendations')->cascadeOnDelete();
            $table->string('event', 32);
            $table->string('status', 32)->nullable();
            $table->unsignedInteger('latency_ms')->nullable();
            $table->unsignedInteger('prompt_tokens')->nullable();
            $table->unsignedInteger('completion_tokens')->nullable();
            $table->unsignedInteger('total_tokens')->nullable();
            $table->decimal('cost_usd', 8, 4)->nullable();
            $table->timestamp('occurred_at')->index();
            $table->timestamp('purge_at')->index();
            $table->timestamps();

            $table->index(['event', 'occurred_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('gpt_recommendation_metrics');
    }
};
