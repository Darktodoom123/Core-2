# Deployment & Hosting Architecture

**Last updated:** 2026-09-15
**Target Environment:** HostForge Platform  
**Platform URL:** [https://hostforgeplatform.cloud/platform](https://hostforgeplatform.cloud/platform)  
**Apex Domain:** `alibaton-ph.com`  
**Core-2 Subdomain:** `core-2.alibaton-ph.com`  

**Verification status:** The user confirmed that Core-2 is not deployed. HostForge is the intended first-deployment platform. The topology below describes the containerized 2-service monorepo architecture (Operations + Tracking), not verified hosting capabilities. The [microservice restructuring handoff](../microservice/README.md) defines the authoritative service boundary; local verification (Tasks 1–7) is complete. Platform capacity, backup/restore, and independent-release evidence is required before production deployment. No hosting account or production data was accessed.

---

## 1. Overview & Domain Topology

Core Transaction 2 (Core-2) is the operational dispatch, fleet, crane/equipment, and workforce assignment engine for Alibaton. First deployment is intended for **HostForge Platform** with domain routing under the `alibaton-ph.com` corporate hierarchy. The endpoint table below is proposed, not evidence of a live deployment.

```
alibaton-ph.com (Apex Domain)
├── core-2.alibaton-ph.com (Core-2 Web Workspace & BFF API - HostForge Platform)
└── [Future Core-1 / Corporate Services]
```

### Host & Endpoint Directory

| Service / Interface | Public URL | Description |
| :--- | :--- | :--- |
| **HostForge Management** | [https://hostforgeplatform.cloud/platform](https://hostforgeplatform.cloud/platform) | Cloud hosting control panel, container orchestration, and runtime management. |
| **Core-2 Web Workspace** | `https://core-2.alibaton-ph.com` | Authenticated Inertia 3 / React 19 operational workspace. |
| **Core-2 Mobile API** | `https://core-2.alibaton-ph.com/api/v1` | Sanctum bearer-token REST API for React Native / Expo field workers. |
| **Laravel Reverb (WebSockets)** | `wss://core-2.alibaton-ph.com/app` | Real-time workspace telemetry, GPS vehicle tracking, and notifications (reverse-proxied over TLS port 443). |
| **Operations Health Routes** | `https://core-2.alibaton-ph.com/up`<br>`https://core-2.alibaton-ph.com/ready` | Configured Laravel health routes: `/up` (process liveness) and `/ready` (migrated database and cache readiness). |
| **Tracking Health Routes** | `http://tracking/up`<br>`http://tracking/ready` | Internal container endpoints: `/up` and `/ready` on the isolated Tracking service (not publicly published). |

---

## 2. Platform & Hosting Architecture (HostForge)

The application is deployed as a two-service containerized architecture orchestrated via Docker Compose:

### Compute & Service Topology
- **Operations Container (`app`)**: Production container running Alpine Linux, Nginx, PHP 8.4 FPM, Laravel Reverb WebSocket server on port 8080, scheduler daemon, and dedicated queue worker pools (`operational`, `ai`, `reports`) supervised via `supervisord`.
- **Tracking Container (`tracking`)**: Production container running Alpine Linux, Nginx, PHP 8.4 FPM, and coordinate retention scheduler daemon. Serves `/internal/v1/` ingestion and query endpoints protected by HMAC-SHA256 signature validation.
- **Operations Database (`db`)**: Managed PostgreSQL 16 database (`core2_production`) or Supabase PostgreSQL with Supavisor connection pooler (port 6543).
- **Tracking Database (`tracking-db`)**: Isolated PostgreSQL 16 database (`core2_tracking_production`) with monthly partitioning for append-only location samples.
- **In-Memory Cache / Key-Value Store (`redis`)**: Redis 7 instance for distributed sessions, atomic rate limiting, and real-time pub/sub brokering for Operations.
- **Edge Reverse Proxy & SSL/TLS**: HostForge ingress edge terminates TLS with automated Let's Encrypt certificates for `core-2.alibaton-ph.com`, proxying HTTP/HTTPS to Operations port 80 and WebSocket upgrades (`Upgrade: websocket`) to port 8080. Tracking is internal-only and not exposed to the public Internet.

```mermaid
flowchart TD
    Client[Web Browser / Field Mobile App] -->|HTTPS / WSS| Edge[HostForge Ingress Edge\ncore-2.alibaton-ph.com]
    
    subgraph HostForge Platform Environment
        Edge -->|HTTP :80| NginxOps[Nginx - Operations]
        Edge -->|WebSocket :8080| Reverb[Laravel Reverb Server]

        NginxOps -->|FastCGI| FPMOps[PHP-FPM Workers]
        FPMOps --> AppOps[Laravel 13 Operations BFF]

        AppOps --> QueueOps[Dedicated Queue Workers\noperational | ai | reports]
        AppOps --> SchedOps[Operations Scheduler]

        AppOps --> DBOps[(PostgreSQL 16 - Operations\ncore2_production)]
        AppOps --> Redis[(Redis 7 Cache / Queues)]

        AppOps -->|Internal HMAC HTTP\nhttp://tracking:80| NginxTrack[Nginx - Tracking]
        NginxTrack -->|FastCGI| FPMTrack[PHP-FPM Tracking]
        FPMTrack --> AppTrack[Laravel 13 Tracking Microservice]
        AppTrack --> SchedTrack[Retention Scheduler\nlocation:prune]
        AppTrack --> DBTrack[(PostgreSQL 16 - Tracking\ncore2_tracking_production)]
    end
```

---

## 3. Production Environment Configuration

Configure the following environment variables within the HostForge platform management dashboard:

### Operations Environment Variables
```dotenv
# Application Configuration
APP_NAME="Alibaton Core-2"
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:<32-byte-base64-generated-key>
APP_URL=https://core-2.alibaton-ph.com

# Session & Security
SESSION_DRIVER=redis
SESSION_LIFETIME=120
SESSION_ENCRYPT=true
SESSION_DOMAIN=.alibaton-ph.com
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=core-2.alibaton-ph.com

# Operations Database Connection (PostgreSQL / Supabase)
DB_CONNECTION=pgsql
DB_HOST=<production-db-host>
DB_PORT=5432
DB_DATABASE=core2_production
DB_USERNAME=<production-db-user>
DB_PASSWORD=<strong-db-password>
DB_SSLMODE=require

# Redis Cache & Queue
REDIS_CLIENT=phpredis
REDIS_HOST=<production-redis-host>
REDIS_PORT=6379
REDIS_PASSWORD=<strong-redis-password>
CACHE_STORE=redis
QUEUE_CONNECTION=redis

# Laravel Reverb (WebSockets on Subdomain)
BROADCAST_CONNECTION=reverb
REVERB_APP_ID=core2-prod
REVERB_APP_KEY=<public-reverb-key>
REVERB_APP_SECRET=<server-only-secret>
REVERB_HOST=0.0.0.0
REVERB_PORT=8080
REVERB_SCHEME=https

# Public Frontend Variables (Compiled into Vite Assets)
VITE_APP_NAME="Alibaton Core-2"
VITE_REVERB_APP_KEY=<public-reverb-key>
VITE_REVERB_HOST=core-2.alibaton-ph.com
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https

# MapLibre GIS Production Credentials
VITE_MAP_PROVIDER=stadia
VITE_MAP_PLAN=starter
VITE_MAP_USE_CASE=commercial
VITE_STADIA_MAPS_API_KEY=<restricted-production-browser-key>

# Telemetry Ingestion & Tracking Microservice Integration
# Drivers: 'stream' (Redis Streams, Phase 2 async default) or 'http' (direct RPC)
TRACKING_SERVICE_DRIVER=stream
TRACKING_SERVICE_URL=http://tracking:8001
TRACKING_SERVICE_SECRET=<strong-random-at-least-16-char-shared-secret>
TRACKING_SERVICE_TIMEOUT=5.0
TRACKING_SERVICE_CONNECT_TIMEOUT=3.0
# Strictly set false in production to eliminate split-brain dual authoritative writes
TRACKING_ALLOW_INGEST_FALLBACK=false

# Redis Stream Telemetry Settings (for driver=stream)
TRACKING_STREAM_KEY=telemetry.gps.v1
TRACKING_STREAM_GROUP=tracking-ingest-workers
TRACKING_DLQ_STREAM_KEY=telemetry.gps.dlq
TRACKING_STREAM_MAXLEN=100000

# Tracking Microservice Read Replica Configuration (apps/tracking/.env)
# DB_HOST routes all ingestion writes and command receipts to primary
# DB_READ_HOST routes high-frequency fleet dispatch map queries to read replicas
TRACKING_DB_HOST=<tracking-primary-db-host>
TRACKING_DB_READ_HOST=<tracking-replica-db-host-1>,<tracking-replica-db-host-2>
TRACKING_DB_PORT=5432
TRACKING_DB_DATABASE=core2_ms_tracking

# Push Notifications Configuration (Milestone 4)
PUSH_NOTIFICATIONS_ENABLED=true
PUSH_PROVIDER=expo
EXPO_PUSH_URL=https://exp.host/--/api/v2/push/send
EXPO_PUSH_RECEIPTS_URL=https://exp.host/--/api/v2/push/getReceipts
# Required only if "Enhanced Push Security" is enabled on the EAS Dashboard
EXPO_PUSH_ACCESS_TOKEN=<eas-personal-access-token-or-empty>
PUSH_TIMEOUT_SECONDS=5.0
PUSH_QUEUE=default

# Deployment Lifecycle Flags
RUN_MIGRATIONS=true
CACHE_CONFIG=true
```

### Tracking Environment Variables
```dotenv
APP_NAME=TrackingService
APP_ENV=production
APP_KEY=base64:<second-32-byte-base64-key>
APP_DEBUG=false
APP_URL=http://tracking

# Tracking Database Connection
DB_CONNECTION=pgsql
DB_HOST=<tracking-db-host>
DB_READ_HOST=<tracking-replica-db-host-1>,<tracking-replica-db-host-2>
DB_PORT=5432
DB_DATABASE=core2_tracking_production
DB_USERNAME=<tracking-db-user>
DB_PASSWORD=<strong-tracking-db-password>
DB_SSLMODE=require

# Service-to-Service Security
TRACKING_SERVICE_SECRET=<strong-shared-service-secret>
TRACKING_ALLOWED_SERVICES=operations

CACHE_STORE=file
CACHE_PREFIX=core2_tracking_cache_
QUEUE_CONNECTION=sync
SESSION_DRIVER=array
RUN_MIGRATIONS=true
CACHE_CONFIG=true
```

### Tracking Consumer Group Monitoring & Operability

Monitor consumer group lag, active consumers, and Pending Entries List (PEL):

```bash
# Inspect consumer group progress, lag, and last delivered message ID
redis-cli XINFO GROUPS telemetry.gps.v1

# Inspect active consumer worker daemons
redis-cli XINFO CONSUMERS telemetry.gps.v1 tracking-ingest-workers

# Check unacknowledged pending messages (PEL)
redis-cli XPENDING telemetry.gps.v1 tracking-ingest-workers

# Monitor poison-pill messages routed to Dead Letter Queue (DLQ)
redis-cli XLEN telemetry.gps.dlq
redis-cli XREVRANGE telemetry.gps.dlq + - COUNT 10
```

---

## 4. Mobile Field App Configuration (`packages/field-mobile`)

Field technicians, drivers, and operators running the React Native / Expo application connect to the HostForge-hosted Core-2 backend via HTTPS:

```dotenv
# packages/field-mobile/.env.production
EXPO_PUBLIC_API_BASE_URL=https://core-2.alibaton-ph.com
```

All API communications target `https://core-2.alibaton-ph.com/api/v1` with Sanctum personal access tokens and persistent offline outbox queuing:
- **Operations-Mediated Telemetry**: Field mobile sends GPS updates to Operations at `POST /api/v1/locations`. Operations validates authorization, driver assignments, and active shifts, then forwards the telemetry to the Tracking microservice via signed HMAC requests.
- **Outage Retries & Offline Preservation**: If Tracking is unavailable, Operations returns `HTTP 503 Service Unavailable` with `Retry-After: 5`. The mobile client retains unacknowledged samples in its SQLite outbox and retries with backoff, ensuring zero data loss without requiring direct mobile access to the Tracking microservice.

---

## 5. Push Notifications Infrastructure & Credentials (Milestone 4)

Native field mobile push notifications (`expo-notifications` via Expo Push Service and Firebase Cloud Messaging HTTP v1) are implemented with runtime verification pending live FCM credentials.

### 5.1. Android Client App Configuration vs. FCM V1 Server Credentials

It is critical to distinguish client-side app configuration from server-side sending credentials:

1. **Client-Side Android Configuration (`google-services.json`)**:
   - **What it is**: An identity configuration file downloaded from the Firebase Console (**Project Settings > General > Your apps > Android app**) registering package `com.core2.fieldmobile`.
   - **Where it lives**: Placed in `packages/field-mobile/` and referenced in `packages/field-mobile/app.json` under `expo.android.googleServicesFile`.
   - **Role**: Instructs the Android client runtime and Google Play Services library on how to communicate with Firebase for registration and device token allocation.
   - **Important**: `google-services.json` contains public identifiers (client API keys, app IDs, project numbers). It does **NOT** grant push sending permissions from a backend server.

2. **Server-Side Sending Credentials (Google Service Account Key for FCM V1)**:
   - **What it is**: A private Google Service Account key in JSON format generated from the Firebase Console (**Project Settings > Service accounts > Generate New Private Key**) with the Firebase Cloud Messaging API enabled.
   - **Where it lives**: Uploaded to Expo Application Services (EAS) via the EAS CLI (`eas credentials` -> **Android > Google Service Account > Manage FCM V1 Key**) or EAS web dashboard. It is **never** committed to version control or included in the mobile client bundle.
   - **Role**: Allows the Expo Push Service backend to authenticate directly to Google's FCM HTTP v1 API (`https://fcm.googleapis.com/v1/projects/{project_id}/messages:send`) to relay push notifications on behalf of the application.
   - **Bypassing Expo (Direct FCM)**: If bypassing Expo's relay service, this service account key would reside on the Operations server to mint Google OAuth 2.0 access tokens.

### 5.2. Expo Access Token & Rate Limits (Official Documentation Clarification)

- **Rate Limits**: Expo Push Service rate limits are strictly **project-scoped** (default: 600 notifications per second per project). Providing an access token does **not** grant enhanced rate limits or higher throughput tiers.
- **Enhanced Push Security**: The `EXPO_PUSH_ACCESS_TOKEN` setting in `apps/operations` is used exclusively for **Enhanced Push Security**. When enabled in the EAS Dashboard, Expo requires that all HTTP requests to `/--/api/v2/push/send` and `/getReceipts` contain `Authorization: Bearer <access_token>`. Any unauthenticated request is rejected with `HTTP 401 UNAUTHORIZED`. This protects against unauthorized push injection in the event that device push tokens are inadvertently exposed.

### 5.3. Provider Delivery Receipts vs. Physical Device Display

- **Provider Receipt (`PushDelivery::STATUS_DELIVERED`)**:
  - Queried via `/--/api/v2/push/getReceipts` using ticket IDs.
  - An `ok` receipt confirms that Expo successfully handed the message off to the upstream push service (Google FCM or Apple APNs).
  - **Critical Invariant**: Provider receipts do **NOT** prove that the notification was physically displayed on the device lock screen. Device-level display can be suppressed or delayed by Android battery optimizations, Doze mode, manufacturer-specific background restrictions, user-disabled notification channels, or Do Not Disturb (DND) modes.
- **Device Opened Acknowledgment (`PushDelivery::STATUS_OPENED`)**:
  - The client application records an explicit tap response via `POST /api/v1/push-deliveries/opened` upon authorized user engagement.
  - Physical lock-screen display verification requires runtime observation on an isolated test device or Android emulator with Google Play Services.

### 5.4. Authoritative Documentation Citations

- [Expo Push Notifications Overview & Sending](https://docs.expo.dev/push-notifications/sending-notifications/)
- [Expo Enhanced Push Security Specification](https://docs.expo.dev/push-notifications/sending-notifications/#enhanced-push-security)
- [Expo Push API Rate Limits FAQ](https://docs.expo.dev/push-notifications/faq/#what-are-the-rate-limits-for-expo-push-notifications)
- [Expo Firebase Cloud Messaging (FCM) Credentials](https://docs.expo.dev/push-notifications/fcm-credentials/)
- [Firebase Cloud Messaging HTTP v1 Migration Guide](https://firebase.google.com/docs/cloud-messaging/migrate-v1)

---

## 6. Security & TLS Checklist

1. **Domain Verification**: Ensure DNS `A` or `CNAME` records for `core-2.alibaton-ph.com` point to the HostForge ingress IP/host.
2. **TLS 1.3 Encryption**: Enforce HTTPS on all routes; plain HTTP requests must redirect with HTTP `301 Moved Permanently`.
3. **CORS & Origin Isolation**:
   - Web workspace origins restricted to `https://core-2.alibaton-ph.com`.
   - API endpoints accept authorization from authenticated mobile clients (`Bearer` token) and stateful web requests with CSRF.
4. **WebSocket Reverse Proxying**: Ensure HostForge / Nginx passes the `Upgrade` and `Connection` headers for `wss://core-2.alibaton-ph.com` connections to port 8080.
5. **Asset Optimization**:
   - Operations: Run `php artisan config:cache`, `php artisan route:cache`, and `php artisan view:cache`.
   - Tracking: Run `php artisan config:cache` and `php artisan route:cache` (`view:cache` is intentionally omitted).

