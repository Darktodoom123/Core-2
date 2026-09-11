<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dvir_inspection_photos', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('dvir_inspection_id')->constrained('dvir_inspections')->cascadeOnDelete();
            $table->string('angle', 32)->index();
            $table->string('file_path');
            $table->string('file_name')->nullable();
            $table->unsignedBigInteger('file_size_bytes')->nullable();
            $table->string('mime_type', 64)->default('image/jpeg');
            $table->timestamps();

            $table->index(['dvir_inspection_id', 'angle']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dvir_inspection_photos');
    }
};
