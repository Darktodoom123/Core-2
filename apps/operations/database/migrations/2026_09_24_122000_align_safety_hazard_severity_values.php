<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('site_hazard_tickets')->where('severity', 'minor')->update(['severity' => 'low']);
        DB::table('site_hazard_tickets')->where('severity', 'moderate')->update(['severity' => 'medium']);
        DB::table('site_hazard_tickets')->where('severity', 'imminent_danger')->update([
            'severity' => 'critical',
            'work_stoppage_issued' => false,
        ]);
    }

    public function down(): void
    {
        DB::table('site_hazard_tickets')->where('severity', 'low')->update(['severity' => 'minor']);
        DB::table('site_hazard_tickets')->where('severity', 'medium')->update(['severity' => 'moderate']);
        DB::table('site_hazard_tickets')->where('severity', 'critical')->update(['severity' => 'imminent_danger']);
    }
};
