# E2E Test Infra: Cloudflare R2 Object Storage Integration

## Test Philosophy
- Opaque-box, requirement-driven. Derives from ORIGINAL_REQUEST.md and user requirements.
- Dual-tier verification: Public media disk (DVIR walkaround photos) and Protected documents disk (signed job reports, compliance PDFs, exports).
- Resilience & Fault Tolerance: Validates graceful fallback when cloud storage is unconfigured or unreachable.
- Security & Zero Leaks: Validates that no credentials leak and private documents cannot be accessed publicly.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 | Tier 2 | Tier 3 |
|---|---------|---------------------|:------:|:------:|:------:|
| 1 | R2 Storage Configuration & CORS | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ |
| 2 | Dual-Tier Disks (r2, r2-public, r2-private) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 3 | Storage Fallback & Error Resilience | Acceptance Criteria | 5 | 5 | ✓ |
| 4 | DVIR Photos Schema & Persistence | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 5 | Public CDN URL Resolution | ORIGINAL_REQUEST §R2, §R3 | 5 | 5 | ✓ |
| 6 | PDF Report Export & Remote Checksums | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 7 | Protected Document Streaming & Pre-Signed URLs | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ |
| 8 | Signed Job Report Attachments | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ |
| 9 | Short-term Export Pruning | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |
| 10 | 7-Year Statutory Compliance Retention | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ |

## Test Architecture
- Test runner: `php artisan test` / Pest 4
- Test files location: `tests/Feature/Storage/`, `tests/Feature/Dvir/`, `tests/Feature/Operations/`
- Pass/fail semantics: 100% test assertions pass, exit code 0

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Complexity |
|---|----------|--------------------|------------|
| 1 | Complete mobile DVIR walkaround submission with 4 photos to R2 | F1, F2, F4, F5 | High |
| 2 | Offline/unconfigured fallback: DVIR submission gracefully falls back to local disk | F3, F4, F5 | High |
| 3 | Full PDF report export workflow: job dispatched, generated on r2-private, downloaded via authenticated stream | F2, F6, F7 | High |
| 4 | Pre-signed URL generation and expiry validation for protected documents | F2, F7, F8 | Medium |
| 5 | 7-year retention enforcement and expired export pruning execution | F9, F10 | Medium |

## Coverage Thresholds
- Tier 1: Feature coverage across public media and protected documents
- Tier 2: Boundary & Corner cases (invalid base64, corrupted magic bytes, max size, empty credentials)
- Tier 3: Cross-feature combinations (fallback recovery, concurrent exports)
- Tier 4: Real-world operational scenarios
