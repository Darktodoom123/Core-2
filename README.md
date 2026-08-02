# Core-2

A modern full-stack web application built with **Laravel 13**, **Inertia 3**, **React 19**, **TypeScript**, **Vite**, and **Tailwind CSS v4**, paired with a **React Native / Expo** mobile application for field operations.

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

You can run the full application stack (Laravel, Inertia/React static assets, Reverb WebSockets, PostgreSQL 16, and Redis 7) using Docker Compose:

### 1. Build & Start Containers
```bash
docker compose up -d --build
```

### 2. Access Application
- Web Application: **[http://localhost:8000](http://localhost:8000)**
- WebSocket Server (Reverb): **`ws://localhost:8080`**

### 3. Seed Database (Optional)
```bash
docker compose exec app php artisan db:seed
```

### 4. Stop Containers
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
