<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_documents', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('operational_asset_id')->constrained('operational_assets')->cascadeOnDelete();
            $table->string('category', 32)->default('road_permits')->index();
            $table->string('document_type', 64)->nullable()->index();
            $table->string('title', 255)->nullable();
            $table->string('document_number', 96)->nullable()->index();
            $table->string('issuing_authority', 255)->nullable();
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('status', 24)->default('active')->index();
            $table->text('notes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['operational_asset_id', 'category']);
            $table->index(['operational_asset_id', 'status']);
            $table->index(['operational_asset_id', 'expires_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table asset_documents add constraint asset_documents_status_check check (status in ('active', 'revoked', 'superseded'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_documents');
    }
};
