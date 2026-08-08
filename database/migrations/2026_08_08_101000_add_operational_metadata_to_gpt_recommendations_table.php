<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            $table->timestamp('generated_at')->nullable()->index()->after('expires_at');
            $table->unsignedInteger('latency_ms')->nullable()->after('generated_at');
            $table->timestamp('purge_at')->nullable()->index()->after('latency_ms');
        });
    }

    public function down(): void
    {
        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            $table->dropColumn(['generated_at', 'latency_ms', 'purge_at']);
        });
    }
};
