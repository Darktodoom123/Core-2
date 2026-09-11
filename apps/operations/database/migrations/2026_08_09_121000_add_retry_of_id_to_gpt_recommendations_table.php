<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            $table->foreignId('retry_of_id')->nullable()->after('requested_by')->unique()->constrained('gpt_recommendations')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            $table->dropForeign(['retry_of_id']);
            $table->dropUnique(['retry_of_id']);
            $table->dropColumn('retry_of_id');
        });
    }
};
