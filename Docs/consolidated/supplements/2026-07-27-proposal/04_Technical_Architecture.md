# Core Transaction 2 — Technical Architecture Proposal

**Document class:** Supplemental source — normalized reference edition  
**Source version:** 1.0  
**Source date:** 2026-07-27  
**Original status:** Draft for Engineering Review  
**Imported:** 2026-07-30  
**Authority:** Alternative architecture proposal; non-canonical  
**Review register:** [Recommendation register](../RECOMMENDATION_REGISTER.md)

## 1. Proposed architecture

The source calls the target “event-driven microservices with CQRS” while also
recommending a modular-monolith-first implementation with extractable service
boundaries.

Its high-level topology proposes:

- React/TypeScript web, React Native mobile, a separate admin web app, and
  external systems;
- CDN/WAF and Kong or AWS API Gateway;
- multiple Node.js/NestJS API instances;
- Redis or RabbitMQ queues and Socket.io real-time services;
- PostgreSQL, Redis, Elasticsearch, TimescaleDB, and S3/MinIO;
- Kubernetes, Terraform, and AWS/GCP managed infrastructure; and
- separate Python/FastAPI AI services.

This is an option catalogue, not the accepted CT2 topology.

## 2. Proposed technology stack

| Layer | Source proposal | Current treatment |
| --- | --- | --- |
| Web | React 18+, Vite, React Router, Zustand/React Query, Radix, Tailwind, Recharts/D3, Socket.io | Alternative; current web is Inertia 3 + React 19 |
| Mobile | Expo, React Navigation, Zustand/React Query, WatermelonDB, Expo modules | Some concepts relevant; use accepted native contract |
| Backend | Node 20, NestJS, Prisma, Passport/JWT, REST+GraphQL, BullMQ | Rejected as current baseline |
| Data | PostgreSQL 16, TimescaleDB, Redis, Elasticsearch, S3 | PostgreSQL/S3 align broadly; other services need measured adoption triggers |
| Platform | Docker, Kubernetes, GitHub Actions, Terraform, Datadog/New Relic/Sentry | Operations option set, not accepted wholesale |
| AI | FastAPI, scikit-learn, OR-Tools/OSRM, TensorFlow/PyTorch, Isolation Forest | Deferred research beyond bounded GPT scope |

## 3. Proposed domain contexts

The source names Identity, Dispatch, Scheduling, Fleet, Field, Fuel, Reporting,
AI/ML, and a Shared Kernel. Useful conceptual relationships include:

- identity references in dispatch and scheduling;
- dispatch events informing schedules and field clients;
- fleet availability constraining dispatch;
- field location updating tracking;
- advisory recommendations consumed by dispatch, schedule, and fleet.

Canonical CT2 uses five product modules plus shared services. Context language
may clarify ownership but must not create a competing module taxonomy.

## 4. Proposed data model

The source SQL sketches:

- users and JSON-based roles;
- jobs with direct driver/operator/technician/vehicle/crane foreign keys;
- job status history;
- polymorphic schedules;
- separate vehicles and cranes;
- personnel qualifications;
- Timescale GPS tracks;
- fuel requests; and
- audit logs.

The sketch is non-executable reference material. It conflicts with current
normalized assignments, `operational_assets`, Spatie permissions, Laravel
migrations, canonical states, and server authorization. Never apply it as a
migration.

Potentially reusable data concerns:

- unique operational references;
- indexed status/time/resource lookups;
- append-only status/audit history;
- explicit qualification expiry;
- capture and receive timestamps for location;
- private object references rather than file blobs; and
- retention-aware archival.

## 5. Proposed flow patterns

### Command flow

Gateway → authentication → validation → command handler → domain logic →
repository/PostgreSQL → events → side effects.

### Query flow

Gateway → authentication → query handler → cache/database/search → DTO.

### Real-time location flow

Mobile update → validation/geofence processing → time-series persistence →
cache/pub-sub → WebSocket clients.

The separation of boundary validation, domain actions, persistence, and side
effects is useful. Current Laravel actions, policies, transactions, queues,
Inertia responses, and `/api/v1` adapters remain authoritative.

## 6. Proposed HTTP contract

The source proposes `/v1` REST resources for auth, users, roles, jobs,
schedules, personnel, fleet, cranes, equipment, GPS, fuel, reports, AI, and
dashboard, plus Socket.io subscription events. It also proposes:

- bearer JWT authentication;
- page/limit pagination;
- generic filtering and sorting;
- REST status conventions; and
- GraphQL for complex queries.

Current browser writes use session authentication, CSRF, Inertia redirects,
validation bags, and typed flash. JSON is reserved for the Sanctum-authenticated
`/api/v1` mobile boundary. Endpoint ideas must be mapped to
[HTTP API](../../../API.md), not added as a parallel contract.

## 7. Proposed security and operations

The source recommends MFA/SSO hooks, RBAC, TLS, encryption, PII controls,
immutable audit logs, secrets management, structured logs, OpenTelemetry,
monitoring thresholds, multi-environment delivery, blue/green deployment,
multi-AZ data services, PITR, and recovery exercises.

These are valuable review prompts. Provider-specific claims and exact controls
need current architecture, threat, cost, and runbook evidence.

## 8. Proposed performance and recovery targets

| Area | Source target |
| --- | --- |
| FCP/LCP/TTI | 1.0/2.0/3.0 second targets |
| API p50/p95/p99 | 100/500/1000 ms targets |
| WebSocket | Under 50 ms target |
| Mobile launch | Under 2 seconds |
| Initial/total bundle | Under 200 KB/1 MB |
| PostgreSQL RPO/RTO | 5/15 minutes |
| Application RTO | 10 minutes |

Treat these as candidate measurements. Accepted capstone availability and
recovery values are in [Phase 0 baseline](../../../phase-0-baseline.md).

## 9. Architecture adoption gate

No proposed technology becomes a dependency until a recorded architecture
decision:

1. identifies a measured constraint;
2. compares the Laravel/database-queue/polling baseline and simpler options;
3. describes security, privacy, cost, operations, and staffing impact;
4. defines migration, observability, failure, and rollback behavior; and
5. assigns an owner and acceptance evidence.

## 10. Initial disposition

| Proposal | Initial disposition |
| --- | --- |
| Modular boundaries and action/query separation | Accepted with current Laravel shape |
| Node/NestJS/Prisma replacement | Rejected |
| JWT browser flow | Rejected |
| API gateway/microservices/Kubernetes baseline | Rejected; reconsider only from evidence |
| Redis/Elasticsearch/Timescale mandatory use | Needs evidence |
| Structured logging/tracing/monitoring | Accepted direction; provider proof remains |
| Geofence/traffic/route optimization | Deferred research |
| Multi-region/high-availability topology | Deferred; compare with accepted single-region baseline |

