<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dispatch_reference_sequences', function (Blueprint $table): void {
            $table->unsignedSmallInteger('reference_year');
            $table->unsignedInteger('next_number')->default(1);
            $table->timestamps();
            $table->primary('reference_year');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dispatch_reference_sequences');
    }
};
