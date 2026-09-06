<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dvir_inspection_photos', function (Blueprint $table): void {
            $table->string('storage_disk', 32)->default('public')->after('angle');
            $table->string('sha256_checksum', 64)->nullable()->after('mime_type');
        });
    }

    public function down(): void
    {
        Schema::table('dvir_inspection_photos', function (Blueprint $table): void {
            $table->dropColumn(['storage_disk', 'sha256_checksum']);
        });
    }
};
