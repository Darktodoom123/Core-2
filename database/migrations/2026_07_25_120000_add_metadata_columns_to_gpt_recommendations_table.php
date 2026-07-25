<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            if (! Schema::hasColumn('gpt_recommendations', 'cost_usd')) {
                $table->decimal('cost_usd', 8, 4)->nullable();
            }
            if (! Schema::hasColumn('gpt_recommendations', 'error_message')) {
                $table->text('error_message')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            $columnsToDrop = [];
            if (Schema::hasColumn('gpt_recommendations', 'cost_usd')) {
                $columnsToDrop[] = 'cost_usd';
            }
            if (Schema::hasColumn('gpt_recommendations', 'error_message')) {
                $columnsToDrop[] = 'error_message';
            }
            if ($columnsToDrop !== []) {
                $table->dropColumn($columnsToDrop);
            }
        });
    }
};
