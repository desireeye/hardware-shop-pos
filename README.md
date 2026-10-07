# Hardware Shop POS & Inventory Management System

A practical POS and inventory management foundation for a small-to-medium hardware shop in India. The current module focuses on building a reliable application foundation so future business modules can be added cleanly without rewriting the system.

## Project Description

This project is structured as a monorepo with a React + TypeScript frontend and a Node.js + TypeScript backend. The foundation includes:

- Frontend shell with sidebar, top navigation, and placeholder modules
- Backend REST API
- PostgreSQL + Prisma data layer
- Shared application configuration and environment setup
- Centralized validation and error-handling foundations
- Seed data structure for categories, brands, suppliers, and products
- Clean project architecture that supports future POS, billing, customer, and reporting modules

## Technology Stack

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: Node.js + TypeScript + Express
- Database: PostgreSQL
- ORM: Prisma
- Validation: Zod
- Styling: Tailwind CSS

## Prerequisites

- Node.js 18+
- npm 9+
- PostgreSQL 14+
- A database client such as pgAdmin or psql

## Project Structure

```text
hardware-shop/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── layouts/
│   │   ├── hooks/
│   │   ├── services/
│   │   ├── types/
│   │   └── utils/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── validators/
│   │   └── app.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── .prisma/
```

## Installation

1. Clone the repository.
2. Navigate to the project directory.
3. Install dependencies:

```bash
npm install
```

## Environment Setup

Copy the example environment file and update values:

```bash
cp .env.example .env
```

Update the values in `.env`:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hardware_shop?schema=public"
JWT_SECRET="replace_with_a_secure_secret"
PORT=4000
FRONTEND_URL="http://localhost:5173"
```

## Database Setup

1. Start PostgreSQL.
2. Create a database named `hardware_shop`.
3. Run Prisma migration:

```bash
npm run prisma:migrate
```

## Migration Commands

```bash
npm run prisma:generate
npm run prisma:migrate
```

## Seed Commands

```bash
npm run prisma:seed
```

## Development Commands

Start both frontend and backend together:

```bash
npm run dev
```

Start them separately:

```bash
npm run dev:backend
npm run dev:frontend
```

## Production Build Commands

```bash
npm run build:backend
npm run build:frontend
```

## Architecture Notes

The project is intentionally split into separate frontend and backend packages to keep concerns isolated and make future modules easier to extend. The backend focuses on REST APIs, Prisma access, validation, and centralized error handling. The frontend is a simple app shell that will gradually add modules like dashboard, sales, inventory, customer management, and reporting.

## Current Module Status

- Frontend shell complete
- Backend foundation complete
- Data model foundation ready for future work
- Health endpoint ready
- Prisma schema and seed script ready
- Validation and error handling foundation ready

## Development Credentials

For development and demo purposes only:

- Email: admin@example.com
- Password: ChangeMe123!

This is a seed account for local development. The owner is required to change the password on first login.

## Authentication Module (Module 2)

The project now includes a secure authentication foundation:

- Email and password login
- Bcrypt password hashing
- HttpOnly JWT cookie-based authentication
- Logged-in user session retrieval
- Logout support
- Protected frontend routes
- Role-based access control for admin and staff
- Admin-only user management endpoints
- Audit logging for login, logout, and password-related events

## Backup and export guidance

### Safe data export

The system exposes admin-only CSV exports through the reports endpoints for sales, products, customers, purchases, returns, inventory, and suppliers. These exports intentionally exclude secrets, cookies, password data, bearer tokens, and database URLs.

### Manual PostgreSQL backup

The app does not expose an arbitrary shell-command backup endpoint. For a safe local backup, use PostgreSQL directly from the terminal:

```bash
pg_dump -U postgres -h localhost -d hardware_shop -f hardware_shop_backup.sql
```

To restore:

```bash
psql -U postgres -h localhost -d hardware_shop < hardware_shop_backup.sql
```

Do not store database credentials in exported files or in frontend code. Keep `.env` values local and never commit them.

## Notes

This project continues to preserve the live PostgreSQL database and uses safe read-only reporting exports without adding destructive resets or unsafe dynamic shell commands.
