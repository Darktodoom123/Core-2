<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            $table->string('automation_hash', 64)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('gpt_recommendations', function (Blueprint $table): void {
            $table->dropColumn('automation_hash');
        });
    }
};
