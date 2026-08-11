# Core-2

A modern full-stack web application for Alibaton's heavy-equipment rental and
service operations, built with **Laravel 13**, **Inertia 3**, **React 19**,
**TypeScript**, **Vite**,
and **Tailwind CSS v4**, paired with a **React Native / Expo** mobile application
for field operations. Alibaton also sells heavy equipment. The repository now
contains partial, API-first rental and sales workflows; customer-facing
commercial screens, contracts, payments, billing, and complete dispatch
handoffs remain roadmap work.

See the [Alibaton business context and CT2 capstone scope](Docs/alibaton-business-scope.md)
for the current rental, sales, and service boundary.

---

## 🛠️ Tech Stack

- **Backend**: PHP 8.3+, Laravel 13, Laravel Sanctum, Spatie Laravel Permission, Laravel Reverb (WebSockets), Pest 4, PHPStan, Pint.
- **Frontend**: React 19, Inertia 3, TypeScript 5.7+, Vite 8, Tailwind CSS v4, ESLint, Prettier.
- **Database**: SQLite (default for development), MySQL / PostgreSQL compatible.
- **Mobile App**: Expo 57, React Native 0.86, Expo SQLite, Detox E2E.

---

## 📋 Prerequisites

Ensure your system has the following installed before setting up the project:

- **PHP**: `^8.3` (with extensions: `pdo_pgsql`, `pdo_sqlite`, or `pdo_mysql`, `mbstring`, `openssl`, `curl`, `bcmath`, `fileinfo`, `xml`, `zip`)
- **Composer**: `2.x+`
- **Node.js**: `20.x` or `22.x+` (LTS recommended)
- **npm**: `10.x+`
- **Git**
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
Copy `.env.example` to create your local `.env` file:

```bash
# macOS / Linux
cp .env.example .env

# Windows (PowerShell)
copy .env.example .env
```

### 3. Run Automated Project Setup
Initialize dependencies, application key, database, and frontend build with a single command:

```bash
composer run setup
```

*(This command executes `composer install`, key generation, database migration, `npm install`, and `npm run build`.)*

### 4. Seed Database with Default Data
Seed the default roles, permissions, and initial admin account:

```bash
php artisan db:seed
```

### 5. Start Development Stack
Launch all background services concurrently (Laravel server, queue listener, Reverb WebSocket server, and Vite dev server):

```bash
composer run dev
```

Open your browser and navigate to: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**

---

## 🐳 Running with Docker

The repository includes a production-ready Docker Compose stack with Laravel 13, built Inertia/React assets, Nginx, Supervisor background workers, Laravel Reverb (WebSockets), PostgreSQL 16, and Redis 7.

### 1. Configure Environment
Copy `.env.example` to `.env` and configure your secrets (`APP_KEY`, `DB_PASSWORD`, `REVERB_APP_KEY`, etc.):

- **Local Database (Default)**: Keep `DB_HOST=db` to use the bundled local PostgreSQL 16 container.
- **Cloud Database (Supabase, AWS RDS, Neon)**: Set `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, and `DB_SSLMODE=require` in `.env` to connect to your remote cloud database.

### 2. Build & Launch Stack

```bash
docker compose config --quiet
docker compose up -d --build
```

### 3. Access Services & Operations

- Web Application: **[http://localhost:8000](http://localhost:8000)**
- Reverb WebSocket Server: **`ws://localhost:8080`**

To seed default development data:

```bash
docker compose exec --user www-data app php artisan db:seed
```

To stop the stack while preserving volumes:

```bash
docker compose down
```

---

## 🔑 Default Credentials

- **Email**: `admin@example.com`
- **Password**: `password`

---

## 📱 Field Mobile App (`packages/field-mobile`)

The mobile workspace is located under `packages/field-mobile`.

To start the mobile development server:

```bash
# Install mobile workspace dependencies
npm --prefix packages/field-mobile install

# Start Expo development client
npm run mobile:start
```

When testing on a physical Android device, start Laravel on the local network
instead of the loopback-only development address:

```powershell
npm run mobile:api
```

Keep the phone and development computer on the same Wi-Fi network. The mobile
API origin is configured in `packages/field-mobile/.env.local` (for example,
`http://192.168.254.110:8000`). If Windows Firewall prompts for PHP, allow it
on the private network. A physical device cannot reach `127.0.0.1` on the
development computer.

To run on an Android emulator:

```bash
npm run mobile:android
```

---

## 🧪 Development & Quality Commands

| Action | Command |
| :--- | :--- |
| **Start Dev Servers** | `composer run dev` |
| **Run All Tests** | `composer test` or `php artisan test` |
| **PHP Lint & Format** | `composer run lint` |
| **PHP Static Analysis** | `composer run types:check` |
| **Frontend Lint Check** | `npm run lint:check` |
| **Frontend Formatting Check** | `npm run format:check` |
| **TypeScript Type Check** | `npm run types:check` |
| **Full CI Quality Gate** | `composer run ci:check` |

---

## 📖 Project Documentation

Detailed architecture, business rules, product requirements, database design, and API specs are documented in `Docs/`:

- Read [`Docs/README.md`](Docs/README.md) for the complete index of product & architecture documentation.
- Read the [Docker operations guide](Docs/docker.md) for container setup, runtime commands, persistence, and troubleshooting.
