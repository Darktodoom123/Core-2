<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->timestamp('activated_at')->nullable()->after('activated_by');
        });
    }

    public function down(): void
    {
        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->dropColumn('activated_at');
        });
    }
};
