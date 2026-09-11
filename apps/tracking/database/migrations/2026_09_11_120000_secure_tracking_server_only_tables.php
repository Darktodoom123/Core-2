<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        if (DB::getDriverName() !== 'pgsql') {
            return;
        }

        // Tracking is accessed through its signed Laravel API, never the Data API.
        DB::unprepared(<<<'SQL'
            DO $tracking_security$
            DECLARE
                table_name text;
                role_name text;
                sequence_name text;
            BEGIN
                FOREACH table_name IN ARRAY ARRAY[
                    'migrations', 'location_samples', 'latest_locations', 'tracking_command_receipts'
                ] LOOP
                    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
                    EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM PUBLIC', table_name);
                    sequence_name := pg_get_serial_sequence(format('public.%I', table_name), 'id');

                    IF sequence_name IS NOT NULL THEN
                        EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %s FROM PUBLIC', sequence_name);
                    END IF;

                    FOREACH role_name IN ARRAY ARRAY['anon', 'authenticated'] LOOP
                        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
                            EXECUTE format('REVOKE ALL PRIVILEGES ON TABLE public.%I FROM %I', table_name, role_name);

                            IF sequence_name IS NOT NULL THEN
                                EXECUTE format('REVOKE ALL PRIVILEGES ON SEQUENCE %s FROM %I', sequence_name, role_name);
                            END IF;
                        END IF;
                    END LOOP;
                END LOOP;
            END
            $tracking_security$;
            SQL);
    }

    public function down(): void
    {
        // A rollback must not expose telemetry or migration history to API clients.
        // Table-removal migrations can still roll back while these protections remain.
    }
};
