<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_asset_assignments', function (Blueprint $table): void {
            $table->decimal('site_latitude', 10, 7)->nullable()->after('assignment_type');
            $table->decimal('site_longitude', 10, 7)->nullable()->after('site_latitude');
        });
    }

    public function down(): void
    {
        Schema::table('dispatch_asset_assignments', function (Blueprint $table): void {
            $table->dropColumn(['site_latitude', 'site_longitude']);
        });
    }
};
