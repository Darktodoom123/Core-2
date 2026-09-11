<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('job_reports', function (Blueprint $table): void {
            $table->double('ending_meter_value')->nullable()->after('ended_at');
            $table->string('meter_type', 32)->nullable()->after('ending_meter_value');
            $table->decimal('latitude', 10, 7)->nullable()->after('meter_type');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->text('rejection_reason')->nullable()->after('remarks');
            $table->unsignedInteger('resubmitted_count')->default(0)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('job_reports', function (Blueprint $table): void {
            $table->dropColumn([
                'ending_meter_value',
                'meter_type',
                'latitude',
                'longitude',
                'rejection_reason',
                'resubmitted_count',
            ]);
        });
    }
};
