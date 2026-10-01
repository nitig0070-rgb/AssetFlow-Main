# AssetFlow - Enterprise Asset Lifecycle Manager

AssetFlow is a web application designed to track, schedule, maintain, and audit corporate physical assets, rooms, vehicles, and equipment centrally.

This repository contains both the **Express Node.js Backend** and the **Vite React Frontend** configured to run with a cloud-hosted **PostgreSQL** database (via Neon DB).

---

## Technical Architecture

* **Frontend**: React, Vite, Tailwind CSS v4.
* **Backend**: Node.js, Express, PostgreSQL (`pg` connection pool with SQLite queries backward compatibility wrapper).
* **Database**: PostgreSQL (Neon Cloud Database).

---

## Demo Credentials

You can use the following seeded accounts to log in and explore different role-based workflows (roles, permissions, and department boundaries):

| Role | Email Address | Password | Description / Capabilities |
| :--- | :--- | :--- | :--- |
| **System Admin** | `admin@assetflow.com` | `admin123` | Full system control, role promotion, circular hierarchy resolution. |
| **Asset Manager** | `manager@assetflow.com` | `manager123` | Asset registration, allocations, transfer processing, and audit control. |
| **Department Head** | `head@assetflow.com` | `head123` | Department-scoped approval routing, request review, and department audits. |
| **Employee** | `priya@assetflow.com` | `employee123` | Raising allocations, room booking, requesting repairs, and transfer requests. |

---

## Setup & Installation

### 1. Backend Setup

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create and configure environment variables in `backend/.env`:
   ```env
   PORT=5000
   NODE_ENV=development
   DATABASE_URL=postgresql://neondb_owner:npg_7EHnUSt4NJIl@ep-flat-mode-atwvfoch-pooler.c-9.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   JWT_SECRET=supersecretjwtkeyforassetflowdev123!
   ```

4. Seed the PostgreSQL database with operational mock data (users, categories, assets, allocations, bookings):
   ```bash
   npm run seed
   ```

5. Start the backend development server:
   ```bash
   npm run dev
   ```
   * The server runs on [http://localhost:5000](http://localhost:5000) by default.

---

### 2. Frontend Setup

1. Navigate to the `frontend/` directory:
   ```bash
   cd ../frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the frontend development server:
   ```bash
   npm run dev
   ```
   * The client runs on [http://localhost:5173](http://localhost:5173) by default.

---

## Integration Test Suites

We have built dedicated custom integration test suites to verify backend endpoints and business rules (access controls, conflicts, recursive loop checks, and automated state updates) directly on the PostgreSQL database.

Run these tests inside the `backend/` directory:

1. **Dashboard & Quick Actions**:
   ```bash
   node src/db/test_dashboard_scenarios.js
   ```
2. **Organization master setups** (circular department hierarchies, category config, and last Admin demotion guards):
   ```bash
   node src/db/test_organization_scenarios.js
   ```
3. **Asset Directory details, history queries, and department filters**:
   ```bash
   node src/db/test_asset_directory_scenarios.js
   ```
4. **Asset Allocations, returns, and transfer request routing workflows**:
   ```bash
   node src/db/test_allocation_scenarios.js
   ```
5. **Resource Bookings calendar, reschedule adjustments, and overlap validations**:
   ```bash
   node src/db/test_booking_scenarios.js
   ```
6. **Maintenance request reviews, assignments, and repair updates**:
   ```bash
   node src/db/test_maintenance_workflow_scenarios.js
   ```
7. **Asset verification audits discrepancies, discrepancy reports, and lost auto-reconciliation**:
   ```bash
   node src/db/test_audit_cycle_scenarios.js
   ```
8. **Summary charts analytics, heatmaps, CSV downloads, notifications feeds, and activity logs**:
   ```bash
   node src/db/test_reports_notifications_scenarios.js
   ```