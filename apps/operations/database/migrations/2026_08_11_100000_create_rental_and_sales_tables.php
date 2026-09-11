<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('service_requests', function (Blueprint $table): void {
            $table->string('business_line', 16)->default('service')->after('client_id')->index();
        });

        Schema::create('rental_reservations', function (Blueprint $table): void {
            $table->id();
            $table->string('reference', 48)->unique();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('dispatch_job_id')->nullable()->constrained()->nullOnDelete();
            $table->string('status', 24)->default('requested')->index();
            $table->date('start_date')->index();
            $table->date('end_date')->index();
            $table->text('delivery_location')->nullable();
            $table->string('fulfillment_mode', 16)->default('delivery');
            $table->text('notes')->nullable();
            $table->unsignedInteger('total_cents')->default(0);
            $table->softDeletes();
            $table->timestamps();
            $table->index(['client_id', 'status']);
            $table->index(['status', 'start_date', 'end_date']);
        });

        Schema::create('rental_reservation_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rental_reservation_id')->constrained()->cascadeOnDelete();
            $table->foreignId('operational_asset_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity')->default(1);
            $table->unsignedInteger('rate_cents');
            $table->unsignedInteger('line_total_cents');
            $table->timestamps();
            $table->index(['operational_asset_id', 'rental_reservation_id']);
        });

        Schema::create('rental_checkouts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rental_reservation_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('checked_out_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('checked_out_at');
            $table->json('condition_before')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('rental_returns', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('rental_reservation_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('returned_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('returned_at');
            $table->json('condition_after')->nullable();
            $table->text('damage_notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sales_catalog_items', function (Blueprint $table): void {
            $table->id();
            $table->string('sku', 64)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('unit_price_cents');
            $table->unsignedInteger('quantity_on_hand')->default(0);
            $table->unsignedInteger('quantity_reserved')->default(0);
            $table->foreignId('operational_asset_id')->nullable()->unique()->constrained()->nullOnDelete();
            $table->string('status', 24)->default('active')->index();
            $table->timestamps();
            $table->index(['status', 'quantity_on_hand']);
        });

        Schema::create('sales_quotes', function (Blueprint $table): void {
            $table->id();
            $table->string('reference', 48)->unique();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('status', 24)->default('draft')->index();
            $table->char('currency', 3)->default('PHP');
            $table->unsignedInteger('total_cents')->default(0);
            $table->date('valid_until')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::create('sales_quote_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sales_quote_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_catalog_item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('unit_price_cents');
            $table->unsignedInteger('line_total_cents');
            $table->timestamps();
        });

        Schema::create('sales_orders', function (Blueprint $table): void {
            $table->id();
            $table->string('reference', 48)->unique();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('sales_quote_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('status', 24)->default('confirmed')->index();
            $table->char('currency', 3)->default('PHP');
            $table->unsignedInteger('total_cents')->default(0);
            $table->timestamp('fulfilled_at')->nullable();
            $table->timestamps();
        });

        Schema::create('sales_order_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sales_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_catalog_item_id')->constrained()->restrictOnDelete();
            $table->unsignedInteger('quantity');
            $table->unsignedInteger('unit_price_cents');
            $table->unsignedInteger('line_total_cents');
            $table->timestamps();
        });

        Schema::create('sales_inventory_ledger', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sales_catalog_item_id')->constrained()->restrictOnDelete();
            $table->foreignId('sales_order_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('entry_type', 16);
            $table->integer('quantity_delta');
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->index(['sales_catalog_item_id', 'entry_type']);
        });

        Schema::create('ownership_transfers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('sales_order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_order_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sales_catalog_item_id')->constrained()->restrictOnDelete();
            $table->foreignId('operational_asset_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('transferred_by')->constrained('users')->restrictOnDelete();
            $table->timestamp('transferred_at');
            $table->timestamps();
            $table->unique(['sales_order_item_id', 'sales_catalog_item_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ownership_transfers');
        Schema::dropIfExists('sales_inventory_ledger');
        Schema::dropIfExists('sales_order_items');
        Schema::dropIfExists('sales_orders');
        Schema::dropIfExists('sales_quote_items');
        Schema::dropIfExists('sales_quotes');
        Schema::dropIfExists('sales_catalog_items');
        Schema::dropIfExists('rental_returns');
        Schema::dropIfExists('rental_checkouts');
        Schema::dropIfExists('rental_reservation_items');
        Schema::dropIfExists('rental_reservations');
        Schema::table('service_requests', function (Blueprint $table): void {
            $table->dropColumn('business_line');
        });
    }
};
