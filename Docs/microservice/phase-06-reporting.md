# Phase 6 — Extract Reporting

Prerequisite: Tracking and AI reviewed. Field report submission/review, attachments and meter updates remain Operations.

## Coverage and ownership

Move ReportExport lifecycle/execution and analytical datasets to apps/reporting. Keep JobReport writes and business review in Operations.
Support every existing ReportExportType: job_reports, dispatches, fuel_logs, weekly_fuel_consumption, maintenance_logs, location_audit, system_audit, dole_wair, cshp_safe_man_hours, daily_accomplishment; preserve currently allowed formats, filters and row visibility.

Before replacing datasets, create a checked-in mapping for EACH type: current dataset columns/filter/sort/authorization, source owner/records, upsert/delete event fields, projection key, aggregate version, precision/units and completeness watermark. Derive it from the current ReportExportCatalog and dataset classes, with synthetic golden output. Do not mark the phase ready until every row/field has an owner and schema.

## Proposed contracts

POST /internal/v1/exports: request_id UUID, actor_id, export_type, format, validated filters, authorization scope, required_watermarks keyed by producer/stream. Returns 202 with export_id and status. Matching retry returns same export; mismatched payload returns 409.
GET /internal/v1/exports/{id}: scoped status including data_as_of/processed watermarks and pending, processing, completed or failed outcome.
Artifact endpoint is internal and private; Operations reauthorizes before issuing a short-lived download or streaming the artifact.
reporting.export.completed.v1: request_id, export_id, artifact reference (not public URL), checksum, row_count, content_type, completed_at, source_watermarks.
Failed event: request_id, export_id, stable error_code without dataset/secret leakage.

Source-owned upsert/delete facts use Phase 3 envelope and exact dataset mapping. A snapshot/bootstrap export has a watermark and a narrow service identity, not general SQL access.

## Batches

1. Freeze dataset mapping/contracts and golden fixtures; create Reporting projection/export/checkpoint schema and scoped artifact storage.
2. Implement source-owned changes and snapshot bootstrap against synthetic data. Include updates/deletes, version checks and gap handling. Preserve privacy expiry and current authorization boundaries.
3. Reimplement every dataset against Reporting-owned projections. Preserve numerical/date/timezone semantics and show a source watermark. Delay a completeness-sensitive export until required watermarks are satisfied; surface timeout/incomplete status rather than silently omit rows.
4. Replace Operations export execution with authenticated requests/status adapters; recheck access at request, execution and download. Rebuild projections through an explicit task-only command and prove repeatability.

## Acceptance and stop

Compare all types/formats against golden source fixtures, including corrections, deletions, empty results, unauthorized filters and expired coordinates. Test revoked permissions during generation/download, duplicate export commands/events, projection gaps, rebuild and crashed workers.
Stop if any dataset still queries another database, field-report transaction moved, or partial data is labeled complete. Reviewer checks dataset parity, artifact permissions, watermark evidence and recovery.
