# Project: Cloudflare R2 Object Storage Integration

## Architecture
- **Public Media Tier (`r2` / `r2-public`)**: Object storage disk configured with public visibility and CDN domain resolution (`R2_PUBLIC_URL` / `R2_URL`) for vehicle walkaround inspection photos (`dvir_photos`), equipment assets, and operator avatars.
- **Protected Documents Tier (`r2-private`)**: Object storage disk configured with private visibility and `url => null` for signed job completion forms, DVIR compliance sheets, equipment handover audit logs, and report exports (`exports/`).
- **Resilience & Graceful Fallback**: Three-layer fallback architecture: pre-flight configuration validation + runtime S3/network exception catching with fallback to local `public` / `private` disks and structured warning logging.
- **CORS & Access Security**: S3 CORS rules supporting GET, HEAD, PUT, OPTIONS from web dispatch and mobile dev origins. Strict zero credential leaks: secrets exclusively in `.env`.
- **Integrity Controls**: MIME-type magic-byte validation via `finfo` (JPEG, PNG, WebP) and cryptographic SHA-256 checksums computed and recorded on upload.
- **Lifecycle & Retention**: Short-term export draft cleanup (7-day purge via `PruneExpiredExportsJob`) vs 7-year statutory retention (2555 days via `PruneExpiredAttachmentsJob`).

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | R2 Storage Architecture & CORS | S3 CORS policy definition, dual-bucket architecture, and .env.example configuration | M1 | ORIGINAL_REQUEST §R1 |
| 2 | Dual-Tier Filesystem Disks | `r2`/`r2-public` and `r2-private` disks in `config/filesystems.php` with `use_path_style_endpoint => true` | M1 | ORIGINAL_REQUEST §R2 |
| 3 | Storage Fallback Service & Logging | Preflight credential check + runtime exception fallback to `public`/`private` with logging | M1 | ORIGINAL_REQUEST Acceptance Criteria |
| 4 | DVIR Schema Migration | `storage_disk` and `sha256_checksum` columns on `dvir_inspection_photos` | M2 | Survey Explorer 2 |
| 5 | DVIR Walkaround Photo Pipeline | Magic-byte MIME validation, SHA-256 calculation, fault-tolerant write to `r2-public` in `CreateDvirInspectionAction` | M2 | ORIGINAL_REQUEST §R3 |
| 6 | Public CDN URL Resolution | `DvirInspectionPhoto::url()` and `DvirInspectionPhotoResource` resolving via recorded `storage_disk` | M2 | ORIGINAL_REQUEST §R2, §R3 |
| 7 | Protected PDF & Export Generation | Update `GenerateReportExportJob`: in-memory/stream SHA-256 checksum (eliminating remote `Storage::path()` crash), local mPDF font cache (`storage_path('app/temp/mpdf_cache')`), write to `r2-private` | M3 | ORIGINAL_REQUEST §R3 |
| 8 | Protected Document Access Mechanisms | Hybrid download support in `ReportExportController` & `AttachmentController`: authenticated streaming default + temporary pre-signed URLs (15-min) | M3 | ORIGINAL_REQUEST §R2, Acceptance Criteria |
| 9 | Signed Job Report Attachments | Wire `JobReport` digital signatures and attachments to `r2-private` via `config/attachments.php` | M3 | ORIGINAL_REQUEST §R3 |
| 10 | Short-term Export Pruning | Update `PruneExpiredExportsJob` to target configured protected disk and register console command `reports:prune-expired` | M4 | ORIGINAL_REQUEST §R4 |
| 11 | 7-Year Statutory Compliance Retention | Validate `PruneExpiredAttachmentsJob` (2555-day retention) and register console command `attachments:prune-expired` | M4 | ORIGINAL_REQUEST §R4 |
| 12 | Test Suite Hardening & False Positive Elimination | Fix `DvirInspectionApiTest` line 388 false positive; add tests for R2 upload, fallback, invalid MIME rejection, and pre-signed URLs | M5 | Survey Explorer 2 & 3 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | R2 Storage Configuration & Dual Disks | S3 CORS policy, `config/filesystems.php` dual disks (`r2`/`r2-public`, `r2-private`), `.env.example`, and fallback service | none | PLANNED |
| M2 | DVIR Photo Persistence & CDN Resolution | Migration for `storage_disk` and `sha256_checksum`, `CreateDvirInspectionAction` refactor with MIME/SHA-256/fallback, model and resource updates | M1 | PLANNED |
| M3 | Protected Documents, PDF Generation & Signed URLs | `GenerateReportExportJob` remote checksum fix + mPDF cache, `ReportExportController`/`AttachmentController` streaming & pre-signed URLs, `JobReport` attachment integration | M1 | PLANNED |
| M4 | Lifecycle Retention & Pruning | Update `PruneExpiredExportsJob` for protected disk, register `reports:prune-expired` and `attachments:prune-expired` console commands | M1, M3 | PLANNED |
| M5 | E2E Testing, Quality Gates & Verification | Comprehensive Pest tests across DVIR photos, report exports, storage drivers, PHPStan (0 errors), Pint (0 issues) | M2, M3, M4 | PLANNED |

## Interface Contracts
### Public Media Interface
- Disk name: `r2` (alias `r2-public`).
- Public URL generation: `Storage::disk('r2')->url($path)` returns `{$R2_PUBLIC_URL}/{$path}`.
- Upload contract: `Storage::disk('r2')->put($path, $binary, ['visibility' => 'public'])`.

### Protected Documents Interface
- Disk name: `r2-private` (configurable via `config('filesystems.protected_disk', 'r2-private')`).
- Access contract:
  * Authenticated streaming: `Storage::disk('r2-private')->download($path, $filename, $headers)`.
  * Pre-signed URL: `Storage::disk('r2-private')->temporaryUrl($path, now()->addMinutes(15), $options)`.
- Checksum contract: SHA-256 calculated in-memory or via streaming BEFORE calling remote storage; never call `Storage::path()` on remote disks.

## Code Layout
- `config/filesystems.php`: Dual-tier disks configuration (`r2`, `r2-public`, `r2-private`).
- `config/attachments.php`: Protected documents disk binding.
- `database/migrations/`: New migration for `dvir_inspection_photos` (`storage_disk`, `sha256_checksum`).
- `app/Modules/Dvir/Actions/CreateDvirInspectionAction.php`: MIME magic-byte validation, SHA-256 calculation, fault-tolerant write.
- `app/Modules/Dvir/Models/DvirInspectionPhoto.php`: Fillable fields, disk-aware URL accessor.
- `app/Modules/Dvir/Http/Resources/V1/DvirInspectionPhotoResource.php`: Expose `sha256_checksum`.
- `app/Platform/Reporting/Jobs/GenerateReportExportJob.php`: In-memory/stream SHA-256, persistent mPDF font cache, protected disk.
- `app/Platform/Reporting/Jobs/PruneExpiredExportsJob.php`: Protected disk pruning.
- `app/Platform/Reporting/Http/Controllers/ReportExportController.php`: Hybrid streaming & pre-signed URL download.
- `app/Platform/Attachments/Http/Controllers/AttachmentController.php`: Hybrid streaming & pre-signed URL download.
- `routes/console.php`: Prune console command registrations.
- `tests/Feature/`: Pest tests for DVIR photos, report exports, pre-signed URLs, and fallback resilience.
