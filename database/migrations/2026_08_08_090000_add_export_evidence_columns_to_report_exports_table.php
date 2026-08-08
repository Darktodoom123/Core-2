<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('report_exports', function (Blueprint $table): void {
            $table->json('authorization_snapshot')->nullable()->after('filters');
            $table->string('mime_type', 100)->nullable()->after('file_path');
            $table->string('checksum_sha256', 64)->nullable()->after('mime_type');
        });
    }

    public function down(): void
    {
        Schema::table('report_exports', function (Blueprint $table): void {
            $table->dropColumn(['authorization_snapshot', 'mime_type', 'checksum_sha256']);
        });
    }
};
