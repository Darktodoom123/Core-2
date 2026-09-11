<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_exports', function (Blueprint $table): void {
            $table->timestamp('download_expires_at')->nullable()->index()->after('expires_at');
            $table->timestamp('purge_at')->nullable()->index()->after('download_expires_at');
            $table->string('request_fingerprint', 64)->nullable()->unique()->after('filters');
        });
    }

    public function down(): void
    {
        Schema::table('report_exports', function (Blueprint $table): void {
            $table->dropUnique(['request_fingerprint']);
            $table->dropColumn(['download_expires_at', 'purge_at', 'request_fingerprint']);
        });
    }
};
