# Phase 6 — Compliance reporting worker & export queue isolation (Plan A: Operations Internal)

Prerequisite: Phase 5 (Tracking extraction) reviewed and verified. Field report submissions, attachments, safety reviews, and meter updates remain strictly local to Operations.

## Source and Ownership

- **Code Location**: `app/Platform/Reporting/` remains strictly within Core Operations (`apps/operations`). Separate microservice extraction is rejected under Plan A.
- **Components**: `CreateReportExportAction`, `GenerateReportExportJob`, `ReportExportController`, `JobReportController`, `JobReport`, `ReportExport`, `ReportExportCatalog`, `PruneExpiredExportsJob`, and the 10 export dataset classes:
  - `DoleWairExportDataset` (Department of Labor and Employment - Work Accident / Illness Report statutory compliance)
  - `CshpSafeManHoursExportDataset` (Construction Safety and Health Program statutory safe man-hours compliance)
  - `JobReportsExportDataset`
  - `DispatchesExportDataset`
  - `FuelLogsExportDataset`
  - `WeeklyFuelConsumptionExportDataset`
  - `MaintenanceLogsExportDataset`
  - `LocationAuditExportDataset`
  - `SystemAuditExportDataset`
  - `DailyAccomplishmentExportDataset`
- **Architectural Rationale**: Compliance reporting and operational audits require complex relational joins across dispatch, equipment, crew assignments, DVIR walkarounds, and safety incident logs. Extracting reporting to a separate service would require continuous asynchronous event projections across all these domains, creating projection lag and risking data divergence on statutory DOLE compliance filings. Retaining reporting within Operations on a dedicated background queue ensures relational consistency while isolating resource consumption.

## Dedicated Queue Worker Isolation

- **Queue Channel**: All report generation jobs (`GenerateReportExportJob`) are routed strictly to the `reports` queue (`onQueue('reports')`).
- **Worker Process**: Dedicated supervisor worker process (`php artisan queue:work --queue=reports --tries=2 --timeout=300 --memory=512`).
- **Workload Isolation**: Memory-intensive PDF/Excel generation, CSV streaming, and large dataset aggregations run exclusively on this dedicated worker pool. The web server (Nginx/PHP-FPM) and primary operational dispatch workers (`default` queue) are protected from memory exhaustion and CPU spikes.

## Tracking Telemetry Integration

- **Decoupled Location Audit**: `LocationAuditExportDataset` no longer queries a local `location_updates` table. Instead, it queries the Tracking microservice via `HttpTrackingClient::getLocationHistory(filters, pagination)`.
- **Coordinate Privacy Compliance**: Respects the 30-day privacy retention rule; coordinates older than 30 days are purged by Tracking and omitted from export generation.

## Artifact Storage and Access Control

- Generated files are saved to private storage (`storage/app/private/exports/{export_id}.{format}`) and never stored in publicly accessible directories.
- Download requests (`GET /operations/reports/exports/{export}/download`) revalidate the requesting user's current permissions before streaming the file or issuing a short-lived signed URL.
- Automated daily maintenance: `PruneExpiredExportsJob` runs daily to remove export artifacts older than the configured retention period (default 7 days).

## Batches

1. **Queue Routing & Supervisor Configuration**:
   - Configure `reports` queue in `apps/operations/config/queue.php`.
   - Update `GenerateReportExportJob` to enforce `public $queue = 'reports'`.
   - Add supervisor configuration for `operations-worker-reports` with a 300-second execution timeout and 512MB memory limit.
2. **Decouple LocationAuditExportDataset**:
   - Refactor `LocationAuditExportDataset` to inject `TrackingClientInterface`.
   - Query Tracking HTTP API with time-bounded filters and cursor pagination.
   - Handle Tracking service unavailability gracefully with clear export error messaging.
3. **Memory Optimization & Chunked Streaming**:
   - Refactor large relational datasets (`JobReportsExportDataset`, `DispatchesExportDataset`, `FuelLogsExportDataset`) to use Eloquent cursor queries (`chunk()` / `lazy()`) to avoid loading large result sets into memory at once.
   - Support CSV and Excel streaming for large row counts.
4. **Statutory Compliance Parity & Verification**:
   - Verify calculation parity for DOLE WAIR (disabling injuries, frequency rates, severity rates) and CSHP safe man-hours against statutory formulas and synthetic baseline fixtures.
   - Verify permission enforcement across all 10 report export types.

## Acceptance Tests

- **Queue Isolation**: Launch 5 concurrent large report export requests; verify `default` dispatch queue and web workspace responsiveness remain completely unaffected.
- **Export Lifecycle**: Test state transitions: `pending` -> `processing` -> `completed` (with valid artifact reference) and `failed` (with clean error status).
- **Security Check**: Verify unauthorized users cannot download export artifacts, and expired export files are pruned by `PruneExpiredExportsJob`.
- **Parity Test**: Run `tests/Feature/Platform/Reporting/` test suites verifying all 10 export types generate expected content and column mappings.
