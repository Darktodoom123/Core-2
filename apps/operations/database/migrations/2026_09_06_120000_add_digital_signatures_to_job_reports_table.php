<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_reports', function (Blueprint $table): void {
            $table->string('signer_name')->nullable()->after('resubmitted_count');
            $table->string('signer_role')->nullable()->after('signer_name');
            $table->timestamp('signed_at')->nullable()->after('signer_role');
        });
    }

    public function down(): void
    {
        Schema::table('job_reports', function (Blueprint $table): void {
            $table->dropColumn([
                'signer_name',
                'signer_role',
                'signed_at',
            ]);
        });
    }
};
