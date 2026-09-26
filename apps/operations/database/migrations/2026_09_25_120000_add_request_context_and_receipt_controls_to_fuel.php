<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('fuel_requests', function (Blueprint $table): void {
            $table->string('urgency', 16)->default('normal')->after('purpose');
            $table->timestamp('needed_by')->nullable()->after('urgency');
            $table->unsignedTinyInteger('current_fuel_level_percent')->nullable()->after('needed_by');
            $table->timestamp('withdrawn_at')->nullable()->after('verified_at');
            $table->text('withdrawal_reason')->nullable()->after('withdrawn_at');
            $table->index(['status', 'urgency']);
        });

        Schema::table('fuel_logs', function (Blueprint $table): void {
            $table->string('receipt_number', 64)->nullable()->after('receipt_path');
            $table->string('no_receipt_reason', 32)->nullable()->after('receipt_number');
            $table->text('no_receipt_note')->nullable()->after('no_receipt_reason');
            $table->foreignId('receipt_reviewed_by')->nullable()->after('no_receipt_note')->constrained('users')->nullOnDelete();
            $table->timestamp('receipt_reviewed_at')->nullable()->after('receipt_reviewed_by');
            $table->text('receipt_review_note')->nullable()->after('receipt_reviewed_at');
        });
    }

    public function down(): void
    {
        Schema::table('fuel_logs', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('receipt_reviewed_by');
            $table->dropColumn(['receipt_number', 'no_receipt_reason', 'no_receipt_note', 'receipt_reviewed_at', 'receipt_review_note']);
        });

        Schema::table('fuel_requests', function (Blueprint $table): void {
            $table->dropIndex(['status', 'urgency']);
            $table->dropColumn(['urgency', 'needed_by', 'current_fuel_level_percent', 'withdrawn_at', 'withdrawal_reason']);
        });
    }
};
