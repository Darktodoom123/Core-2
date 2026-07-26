<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_personnel_assignments', function (Blueprint $table): void {
            $table->timestamp('responded_at')->nullable()->after('response_status');
            $table->text('response_reason')->nullable()->after('responded_at');
        });
    }

    public function down(): void
    {
        Schema::table('dispatch_personnel_assignments', function (Blueprint $table): void {
            $table->dropColumn(['responded_at', 'response_reason']);
        });
    }
};
