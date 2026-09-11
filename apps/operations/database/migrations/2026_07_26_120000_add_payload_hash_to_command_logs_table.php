<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('command_logs', function (Blueprint $table): void {
            $table->string('payload_hash', 64)->nullable()->after('action_name')->index();
        });
    }

    public function down(): void
    {
        Schema::table('command_logs', function (Blueprint $table): void {
            $table->dropColumn('payload_hash');
        });
    }
};
