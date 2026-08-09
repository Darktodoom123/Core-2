<?php

use App\Platform\Identity\Support\Username;
use App\Platform\Identity\Support\UsernameBackfill;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'username')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('username', Username::MAX_LENGTH)->nullable();
            });
        }

        DB::transaction(function (): void {
            UsernameBackfill::run();

            if (DB::table('users')->whereNull('username')->exists()) {
                throw new RuntimeException('Username backfill did not populate every user.');
            }
        });

        if (! Schema::hasIndex('users', 'users_username_unique')) {
            Schema::table('users', function (Blueprint $table): void {
                $table->string('username', Username::MAX_LENGTH)->nullable(false)->change();
                $table->unique('username', 'users_username_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->dropUnique('users_username_unique');
            $table->dropColumn('username');
        });
    }
};
