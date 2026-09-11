<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('phone', 32)->nullable()->after('email');
        });

        Schema::create('clients', function (Blueprint $table): void {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('company_name');
            $table->string('contact_person')->nullable();
            $table->string('phone', 32)->nullable();
            $table->string('email')->nullable();
            $table->text('address')->nullable();
            $table->string('status', 24)->default('active')->index();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('service_requests', function (Blueprint $table): void {
            $table->id();
            $table->string('reference', 48)->unique();
            $table->foreignId('client_id')->constrained()->restrictOnDelete();
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->string('project_name');
            $table->string('service_type', 64)->index();
            $table->text('location');
            $table->text('site_notes')->nullable();
            $table->timestamp('scheduled_date')->nullable()->index();
            $table->string('priority', 24)->default('routine')->index();
            $table->string('status', 32)->default('submitted')->index();
            $table->json('requirements')->nullable();
            $table->softDeletes();
            $table->timestamps();
            $table->index(['client_id', 'status']);
            $table->index(['status', 'scheduled_date']);
        });

        Schema::create('personnel_profiles', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->unique()->constrained()->cascadeOnDelete();
            $table->string('employee_number', 48)->nullable()->unique();
            $table->string('availability_status', 24)->default('available')->index();
            $table->string('emergency_contact_name')->nullable();
            $table->string('emergency_contact_phone', 32)->nullable();
            $table->timestamps();
        });

        Schema::create('personnel_credentials', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind', 32);
            $table->string('credential_number', 96);
            $table->string('credential_type', 64);
            $table->date('issued_at')->nullable();
            $table->date('expires_at')->nullable();
            $table->string('status', 24)->default('active')->index();
            $table->foreignId('verified_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('verified_at')->nullable();
            $table->timestamps();
            $table->unique(['kind', 'credential_number']);
            $table->index(['user_id', 'kind', 'expires_at']);
        });

        if (DB::getDriverName() === 'pgsql') {
            DB::statement("alter table clients add constraint clients_status_check check (status in ('active', 'inactive'))");
            DB::statement("alter table service_requests add constraint service_requests_priority_check check (priority in ('routine', 'priority', 'emergency'))");
            DB::statement("alter table personnel_profiles add constraint personnel_profiles_availability_check check (availability_status in ('available', 'assigned', 'unavailable', 'on_leave'))");
            DB::statement("alter table personnel_credentials add constraint personnel_credentials_kind_check check (kind in ('driver_license', 'operator_certification', 'qualification'))");
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('personnel_credentials');
        Schema::dropIfExists('personnel_profiles');
        Schema::dropIfExists('service_requests');
        Schema::dropIfExists('clients');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('phone');
        });
    }
};
