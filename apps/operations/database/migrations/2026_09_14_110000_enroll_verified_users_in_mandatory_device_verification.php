<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Roll out mandatory device verification to all existing users whose email
     * access and recovery readiness have already been established (email_verified_at is not null).
     */
    public function up(): void
    {
        DB::table('users')
            ->whereNotNull('email_verified_at')
            ->update(['email_otp_enabled' => true]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // No-op to prevent disabling security factor on rollback
    }
};
