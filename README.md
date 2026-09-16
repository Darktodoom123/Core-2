# DESIGN AND IMPLEMENTATION OF A GPT MINI POWERED DISPATCH AND RESOURCE MANAGEMENT PLATFORM WITH MOBILE APPLICATION FOR REAL TIME TRACKING FOR FIELD SERVICE MONITORING

**Core Transaction 2 (CT2) — Operations, Dispatch, and Resource Management**

A modern full-stack web and mobile platform for heavy-equipment operations, dispatch scheduling, and field resource management, built with **Laravel 13**, **Inertia 3**, **React 19**, **TypeScript**, **Vite 8**, and **Tailwind CSS v4**, paired with a **React Native / Expo** mobile application for real-time tracking and field service monitoring. Powered by OpenAI **GPT-5-mini** advisory dispatch intelligence.

### 5 Main Operational Modules
1. **Dispatch Job and Scheduling (Real-Time Activation)** — Client service requests, dispatch job creation, priority/emergency approvals, schedule boards, multi-phase project planning, and real-time activation.
2. **Assign Driver/Operator and Equipment** — Worker eligibility, qualification credential checks, equipment assignment, and conflict detection with integrated Hours of Service (HoS) compliance.
3. **Fleet Management** — Fleet vehicles, transport trucks, trailers, roadworthiness, and integrated Driver Vehicle Inspection Reports (DVIR) with walkaround photo verification.
4. **Crane and Equipment Management** — Mobile/tower crane specifications, boom/tonnage capacity charts, pre-use safety checklists, rigging gear inspections, and defect lockouts.
5. **Fuel Management** — Multi-step fuel requests, independent approval, verification, consumption tracking, monotonic meter checks, anomaly detection, and logging.

### System Users
The platform strictly serves **3 User Roles**:
- **System Administrator** (`system_administrator`) — User provisioning, security, master data, and break-glass administrative overrides.
- **Operations Manager** (`operations_manager`) — Central dispatch authority, schedule boards, resource assignments, approvals, fleet readiness, and operations oversight.
- **Operator** (`operator` / `crane_operator`) — Field mobile user advancing dispatch milestones, vehicle inspections, duty logging, and real-time GPS tracking.

*(Non-software field workforce like Riggers are tracked via `PersonnelProfile` and credentials without direct login accounts).*

See the [Alibaton business context and CT2 capstone scope](Docs/product/alibaton-business-scope.md) for the commercial transaction boundary.

---

## 🛠️ Tech Stack & Monorepo Architecture

Core-2 is structured as a two-service monorepo:

- **Operations Monolith & BFF (`apps/operations/`)**:
  - PHP 8.4+, Laravel 13, Laravel Sanctum, Spatie Laravel Permission, Laravel Reverb (WebSockets), Pest 4, PHPStan Level 7 (Larastan), Laravel Pint.
  - React 19, Inertia 3, TypeScript 5.7+, Vite 8, Tailwind CSS v4, MapLibre GL, Lucide React, Motion.
  - Dedicated background queue workers for AI advisory recommendations (`ai` queue) and compliance reporting exports (`reports` queue).
- **Tracking & Telemetry Microservice (`apps/tracking/`)**:
  - PHP 8.4+, Laravel 13 (API-only mode), Pest 4, PHPStan Level 7, Pint.
  - Dedicated database (`core2_ms_tracking`) with monthly partitioning and automated 30-day coordinate privacy retention pruning.
  - HMAC-SHA256 service-to-service authentication (`ValidateServiceSignature` middleware) with `TRACKING_SERVICE_SECRET`.
- **Field Mobile Client (`packages/field-mobile/`)**:
  - React Native 0.86, Expo 57, Expo SQLite (offline transactional outbox), Expo SecureStore, Detox 20.
  - Tactical Cockpit HUD with Daylight and High-Contrast Tactical Dark tokens, DOLE 10h fatigue guardrails, floating emergency SOS jewel.
- **Infrastructure (`infra/docker/`)**:
  - Multi-stage Docker Compose reference stack with Nginx, PHP-FPM, Supervisor process supervisor, PostgreSQL 16, and Redis 7.

---

## 📋 Prerequisites

Ensure your system has the following installed before setting up the project:

- **PHP**: `^8.4` (with extensions: `pdo_pgsql`, `pdo_sqlite`, or `pdo_mysql`, `mbstring`, `openssl`, `curl`, `bcmath`, `fileinfo`, `xml`, `zip`)
- **Composer**: `2.x+`
- **Node.js**: `20.x` or `22.x+` (LTS recommended; tested on Node 22)
- **npm**: `10.x+`
- **Git**
- *(Optional for Docker)*: Docker Desktop with Linux engine and Docker Compose v2.
- *(Optional for Mobile)*: JDK 17+ and Android SDK for local Android emulation/building.

---

## 🚀 Local Quick Start

Follow these steps to set up and run the application locally on your machine:

### 1. Clone the Repository
```bash
git clone <repository-url>
cd Core-2
```

### 2. Environment Configuration
Copy `.env.example` to create your local root `.env` file:

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
Copy-Item .env.example .env
```

### 3. Run Automated Project Setup
Initialize dependencies, application keys, database migrations, and frontend assets with a single command:

```bash
composer run setup
```

*(This command installs dependencies for `apps/operations` and `apps/tracking`, copies default `.env` files if missing, generates the Operations application key, migrates the Operations database, installs workspace npm packages, and builds the frontend bundle.)*

For the Tracking service, generate its application key if running locally:

```bash
php apps/tracking/artisan key:generate
```

### 4. Seed Database with Default Data
Seed default roles, permissions, and initial admin and operational accounts:

```bash
php apps/operations/artisan db:seed
```

### 5. Start Development Stack
Launch all background services concurrently (Laravel operations server, queue listener, Reverb WebSocket server, and Vite dev server):

```bash
composer run dev
```

Open your browser and navigate to: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

*(Optional: To run the Tracking microservice concurrently for local telemetry ingestion, run `php apps/tracking/artisan serve --port=8001` or use Docker Compose.)*

---

## 🐳 Running with Docker

The repository includes a production-style Docker Compose reference stack located in `infra/docker/` and configured via `docker-compose.yml`. It orchestrates:
- `app`: Operations Monolith (Nginx, PHP-FPM, Reverb on port 8080, scheduler, and dedicated queue workers: `operational`, `ai`, `reports`)
- `tracking`: Tracking Microservice (Nginx, PHP-FPM, retention scheduler)
- `db`: PostgreSQL 16 for Operations (`core2`)
- `tracking-db`: PostgreSQL 16 for Tracking (`core2_ms_tracking`)
- `redis`: Redis 7 for cache, queues, and sessions

### 1. Configure Environment
Set required values in your root `.env` (`APP_KEY`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `TRACKING_SERVICE_SECRET`, `TRACKING_APP_KEY`, etc.). For Docker's bundled local database, keep `DB_CONNECTION=pgsql`, `DB_HOST=db`, and `TRACKING_SERVICE_URL=http://tracking`.

### 2. Build & Launch Stack

```bash
docker compose config --quiet
docker buildx build --check .
docker compose up -d --build
```

### 3. Access Services & Health Checks

- Web Application: **[http://localhost:8000](http://localhost:8000)**
- Operations Health: **`http://localhost:8000/up`** (liveness) and **`http://localhost:8000/ready`** (migrated readiness)
- Tracking Health: `docker compose exec tracking curl --fail http://127.0.0.1/up` and `http://127.0.0.1/ready`
- Reverb WebSocket Server: **`ws://localhost:8080`**

To seed default development data in Docker:

```bash
docker compose exec --user www-data app php artisan db:seed
```

Run the isolated service integration suite (verifies mobile client -> Operations BFF -> Tracking microservice pipeline):

```bash
npm run test:integration:services
```

Run the PostgreSQL concurrency suite:

```bash
docker compose --profile test run --build --rm test
```

To stop the stack while preserving named database volumes:

```bash
docker compose down
```

*(Do not use `--volumes` unless you intentionally wish to destroy database and storage state).*

See the [Docker operations guide](Docs/architecture/docker.md) for full permissions, worker topologies, and troubleshooting.

---

## 🔑 Local Default Credentials

- **Email**: `admin@example.com`
- **Password**: `password`

*These credentials apply to the local developer seed only. Production environments require a strong password (`ADMIN_PASSWORD` >= 12 characters).*

---

## 📱 Field Mobile App (`packages/field-mobile`)

The mobile workspace is located under `packages/field-mobile`. It delivers a native field experience tailored for equipment operators and field crews:
- **Tactical Cockpit HUD**: Daylight and high-contrast Tactical Dark HUD mode tokens.
- **Hours of Service (HoS)**: Shift clock-in/out, duty status toggles (`operating`, `driving`, `standby`, `on_break`, `off_duty`), DOLE 10-hour limit warnings, and Night Shift Differential (+10%).
- **Driver Vehicle Inspection Report (DVIR)**: Pre/post-trip inspections, asset classification (heavy crane, earthmoving, transport), 4-angle walkaround photo defect tagging, and immediate safety defect lockout.
- **In-Cab Heavy Crane Drive Mode**: Turn-by-turn navigation HUD with clearance and corridor warning overlays.
- **Floating SOS Jewel**: Docked in a scooped bottom-navigation cradle notch with a 2-second hold trigger modal to prevent accidental activation.
- **Offline-First SQLite Outbox**: Transactional command outbox with bounded exponential backoff, HTTP 429 `Retry-After` rate limit handling, and compressed batch flushing.

To set up and run the mobile app:

```bash
# Copy example environment configuration
cp packages/field-mobile/.env.example packages/field-mobile/.env.local

# Start Expo development client
npm run mobile:start
```

Configure `packages/field-mobile/.env.local` with your API base URL (`EXPO_PUBLIC_API_BASE_URL=http://localhost:8000` or your computer's LAN IP e.g. `http://192.168.1.100:8000` when testing on physical devices) and your `EXPO_PUBLIC_STADIA_MAPS_API_KEY`.

When testing on a physical Android device, start Laravel on the local network:

```powershell
npm run mobile:api
```

To run on an Android emulator or run Detox E2E tests:

```bash
npm run mobile:android
npm run mobile:session1:native:api30
npm run mobile:session1:native:api36
```

---

## 🧪 Development & Quality Commands

All commands are run from the monorepo root:

| Action | Command | Scope |
| :--- | :--- | :--- |
| **Start Dev Servers** | `composer run dev` | Operations server, queue, Reverb, Vite |
| **Run All PHP Tests** | `composer test` | Pest suites across Operations and Tracking |
| **Run Operations Tests** | `composer test:operations` | Pest suite for Operations (`1,163+` tests) |
| **Run Tracking Tests** | `composer test:tracking` | Pest suite for Tracking (`42+` tests) |
| **PHP Lint & Format** | `composer run lint` | Pint formatting across both applications |
| **PHP Lint Check** | `composer run lint:check` | Pint style verification across both applications |
| **PHP Static Analysis** | `composer run types:check` | Larastan Level 7 analysis across both applications |
| **Frontend Lint Check** | `npm run lint:check` | ESLint across web and mobile TypeScript |
| **Frontend Format** | `npm run format` | Prettier formatting across web and mobile source |
| **Frontend Format Check** | `npm run format:check` | Prettier check across resources and mobile |
| **TypeScript Type Check** | `npm run types:check` | `tsc --noEmit` on web workspace |
| **Mobile Type Check** | `npm run types:check:mobile` | `tsc --noEmit` on mobile workspace |
| **Web Unit Tests** | `npm run test:unit` | Vitest unit tests (`328+` tests) |
| **Mobile Tests** | `npm run test:mobile` | Mobile unit (`tsx`) and component (`jest`) tests (`298+` tests) |
| **Mobile Lifecycle E2E** | `npm run test:mobile:lifecycle` | Master mobile lifecycle Pest feature test |
| **Web Browser E2E** | `npm run test:e2e` | Playwright browser test suite |
| **Service Integration** | `npm run test:integration:services` | Bounded Docker runner verifying 2-service stack |
| **Web Production Build** | `npm run build` | Vite production bundle build |
| **Full CI Quality Gate** | `composer run ci:check` | Web lint, format, types, unit tests, and all PHP tests |

---

## 🌐 Production Deployment & Hosting

Core-2 is prepared for deployment on **HostForge Platform** ([https://hostforgeplatform.cloud/platform](https://hostforgeplatform.cloud/platform)) under domain **`alibaton-ph.com`** and dedicated subdomain:

- **Web Workspace & BFF**: **[https://core-2.alibaton-ph.com](https://core-2.alibaton-ph.com)**
- **Mobile REST API Base**: `https://core-2.alibaton-ph.com/api/v1`
- **Reverb WebSocket Stream**: `wss://core-2.alibaton-ph.com/app`
- **Health & Readiness**: `https://core-2.alibaton-ph.com/up` and `https://core-2.alibaton-ph.com/ready`

For detailed production environment configuration, SSL/TLS reverse proxy setup, and database orchestration, see the [Deployment & Hosting Architecture Guide](Docs/architecture/deployment.md).

---

## 📖 Project Documentation

Detailed architecture, business rules, product requirements, database design, API specs, and runbooks are documented in `Docs/`:

- Read [`Docs/README.md`](Docs/README.md) for the complete navigation index across all product and architecture documentation.
- Read the [Deployment & Hosting Guide](Docs/architecture/deployment.md) for HostForge Platform production hosting and runtime environment.
- Read the [Docker Operations Guide](Docs/architecture/docker.md) for container topology, runtime commands, and persistence.
- Read the [Microservice Implementation Guide](Docs/microservice/README.md) and [Target Architecture](Docs/microservice/architecture.md) for the 2-service boundary specifications.
