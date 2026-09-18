<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personnel_credentials', function (Blueprint $table): void {
            if (! Schema::hasColumn('personnel_credentials', 'issuing_authority')) {
                $table->string('issuing_authority', 255)->nullable()->after('credential_type');
            }
            if (! Schema::hasColumn('personnel_credentials', 'notes')) {
                $table->text('notes')->nullable()->after('status');
            }
        });
    }

    public function down(): void
    {
        Schema::table('personnel_credentials', function (Blueprint $table): void {
            if (Schema::hasColumn('personnel_credentials', 'notes')) {
                $table->dropColumn('notes');
            }
            if (Schema::hasColumn('personnel_credentials', 'issuing_authority')) {
                $table->dropColumn('issuing_authority');
            }
        });
    }
};
