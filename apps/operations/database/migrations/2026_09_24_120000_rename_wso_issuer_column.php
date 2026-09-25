<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_stoppage_notices', function (Blueprint $table): void {
            $table->renameColumn('safety_officer_id', 'issued_by');
        });
    }

    public function down(): void
    {
        Schema::table('work_stoppage_notices', function (Blueprint $table): void {
            $table->renameColumn('issued_by', 'safety_officer_id');
        });
    }
};
