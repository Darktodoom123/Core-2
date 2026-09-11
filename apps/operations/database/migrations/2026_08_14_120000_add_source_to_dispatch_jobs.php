<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->string('source_type', 48)->nullable()->index()->after('service_request_id');
            $table->unsignedBigInteger('source_id')->nullable()->after('source_type');
            $table->string('source_reference', 48)->nullable()->after('source_id');
            $table->index(['source_type', 'source_id']);
        });

        DB::table('dispatch_jobs')
            ->whereNotNull('service_request_id')
            ->update([
                'source_type' => 'service_request',
                'source_id' => DB::raw('service_request_id'),
            ]);
    }

    public function down(): void
    {
        Schema::table('dispatch_jobs', function (Blueprint $table): void {
            $table->dropIndex(['source_type', 'source_id']);
            $table->dropColumn(['source_type', 'source_id', 'source_reference']);
        });
    }
};
