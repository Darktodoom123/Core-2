<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('sales_orders', function (Blueprint $table): void {
            $table->foreignId('dispatch_job_id')->nullable()->after('created_by')->constrained()->nullOnDelete();
            $table->string('fulfillment_mode', 16)->default('pickup')->after('dispatch_job_id');
            $table->text('delivery_location')->nullable()->after('fulfillment_mode');
        });
    }

    public function down(): void
    {
        Schema::table('sales_orders', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('dispatch_job_id');
            $table->dropColumn(['fulfillment_mode', 'delivery_location']);
        });
    }
};
