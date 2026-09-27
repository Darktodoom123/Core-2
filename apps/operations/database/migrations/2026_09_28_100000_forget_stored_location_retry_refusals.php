<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Idempotency used to keep a "503, try again" answer for a location ping and
 * replay it for every retry, so that ping could never get through. Those
 * answers are no longer kept; this forgets the ones already stored. A ping
 * refused with 503 wrote nothing, so running it again cannot duplicate it.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('command_logs')
            ->where('action_name', 'location.store')
            ->where('response_code', '>=', 500)
            ->delete();
    }

    /**
     * Nothing to restore: the removed rows only blocked retries.
     */
    public function down(): void
    {
        //
    }
};
