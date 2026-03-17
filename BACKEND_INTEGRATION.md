# EcoChain — Backend Integration Guide

## High-Level Workflow

```
Citizen → Report Waste → AI Agent Pipeline → Municipal Officer → Resolution → Blockchain Reward
```

1. **Citizen** submits a waste report with photo, location, category, severity.
2. **AI Agent Pipeline** (5 stages) processes the report:
   - Waste Verification Agent → validates image & waste type
   - Geo-Intelligence Agent → maps location, detects hotspots
   - Municipal Coordination Agent → assigns to correct department
   - Reward Optimization Agent → calculates Green Token reward
   - Fraud Detection Agent → checks for duplicates/gaming
3. **Municipal Officer** reviews assigned reports, takes action.
4. **Blockchain** mints Green Tokens as reward upon resolution.

---

## Authentication

**Method:** Supabase Auth (email/password)

- Frontend uses `@supabase/supabase-js` for sign-up, sign-in, session management.
- On sign-up, a profile is auto-created via database trigger, and the user selects a role (`citizen`, `municipal_officer`, `city_planner`).
- Roles are stored in `public.user_roles` table (never on the profile itself).
- Route protection uses `has_role()` security definer function.
- The Supabase access token is passed as `Authorization: Bearer <token>` to backend API calls.

### Role Mapping

| Role | Access |
|---|---|
| citizen | Dashboard, Report Waste, My Reports, Rewards, Hotspots |
| municipal_officer | All citizen routes + Municipal Dashboard |
| city_planner | All citizen routes + Analytics Dashboard |
| admin | All routes |

---

## Data Access Architecture

EcoChain uses a **hybrid data-fetching model** with two distinct paths:

| Path | When to use | Auth mechanism |
|---|---|---|
| **Frontend → Supabase** (direct) | Simple CRUD on user-scoped or public data | Supabase RLS enforced via user's access token |
| **Frontend → Backend API** (backend → Supabase internally) | AI pipeline, municipal actions, admin aggregations, blockchain | Backend validates Supabase access token & role, then queries Supabase with service role |

**Key rule:** The frontend **never** queries all reports across all users directly from Supabase. City-wide or cross-user data is always fetched through the backend API.

---

## API Endpoints

Base URL: `VITE_API_BASE_URL` environment variable.

All backend API endpoints expect `Authorization: Bearer <supabase_access_token>`.

### Auth (handled by Supabase directly)

- Sign up: `supabase.auth.signUp()`
- Sign in: `supabase.auth.signInWithPassword()`
- Session: `supabase.auth.getSession()`

---

### Reports

#### Frontend → Supabase (direct)

| Operation | Description |
|---|---|
| `SELECT` from `reports` | Citizen's own reports with filters & pagination. RLS ensures `user_id = auth.uid()`. |
| `INSERT` into `reports` | Create a new report row (user_id set to `auth.uid()`). |
| `SELECT` from `report_events` | Fetch AI pipeline status for a specific report (polled every 5s). RLS scoped to reports the user owns. |

#### Frontend → Backend API

| Method | Path | Description |
|---|---|---|
| `POST` | `/reports/upload` | Upload report image. Returns `{ url }`. |
| `POST` | `/reports/:id/process` | Trigger the 5-stage AI agent pipeline for a report. |

---

### Municipal

All municipal operations go through the backend API. The backend validates the user holds the `municipal_officer` role via the Supabase access token, then queries Supabase internally using the service role.

#### Frontend → Backend API

| Method | Path | Description |
|---|---|---|
| `GET` | `/municipal/reports?status=<status>` | List all city-wide reports, optionally filtered by status. Backend queries Supabase `reports` table with service role (no RLS bypass on frontend). |
| `POST` | `/municipal/reports/:id/assign` | Assign a report to a department or officer. |
| `POST` | `/municipal/reports/:id/resolve` | Mark a report as resolved. Triggers reward minting. |

---

### Hotspots

#### Frontend → Supabase (direct)

| Operation | Description |
|---|---|
| `SELECT` from `hotspots` | Public read of all hotspot data. No RLS restriction (public table). |

> If hotspot aggregation or recalculation is needed, it is performed by the backend (e.g., triggered after report processing) and written back to the `hotspots` table. The frontend only reads.

---

### Rewards / Tokens

#### Frontend → Supabase (direct)

| Operation | Description |
|---|---|
| `SELECT` from `token_transactions` | User's own transaction history. RLS ensures `user_id = auth.uid()`. |

#### Frontend → Backend API

| Method | Path | Description |
|---|---|---|
| `GET` | `/citizen/tokens` | Current token balance (backend reads from blockchain or aggregates from `token_transactions`). |

---

### Admin / City Planner Analytics

All analytics endpoints go through the backend API. The backend validates the user holds the `city_planner` or `admin` role, then aggregates data from Supabase internally.

#### Frontend → Backend API

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/metrics` | Overall metrics (total reports, resolution rate, avg response time, total tokens minted). |
| `GET` | `/admin/metrics/by-area` | Report counts and severity aggregated by geographic area. |
| `GET` | `/admin/metrics/by-severity` | Report distribution by severity level. |
| `GET` | `/admin/metrics/tokens-over-time` | Token minting volume over time (for charts). |

---

## Pipeline Status Mapping

The `report_events` table stores AI agent processing stages:

```
agent_type: waste_verification | geo_intelligence | municipal_coordination | reward_optimization | fraud_detection
stage_status: pending | processing | completed | failed
```

The frontend polls `report_events` every 5 seconds and renders a stepper/timeline showing each agent's progress. The backend is responsible for inserting/updating these events as the AI pipeline progresses.

---

## Supabase Tables

| Table | Purpose |
|---|---|
| `profiles` | User profile data (auto-created on signup) |
| `user_roles` | Role assignments (citizen, municipal_officer, city_planner, admin) |
| `reports` | Waste reports with location, category, severity, status |
| `report_events` | AI agent pipeline events per report |
| `hotspots` | Aggregated waste hotspot areas |
| `token_transactions` | Green Token transaction records |

### Storage Buckets

| Bucket | Purpose |
|---|---|
| `report-images` | Public bucket for waste report photos |

### RLS & Security

All direct Supabase queries from the frontend are protected by **Row Level Security (RLS)** using a `has_role()` security definer function. Citizens can only see their own rows (e.g., their own reports and token transactions). Hotspots are publicly readable. Municipal officers and city planners access broader, cross-user data **only via backend API endpoints**, where the backend validates the Supabase access token and role before querying Supabase with the service role key or appropriate policies. This ensures no privilege escalation is possible from the frontend.

---

## Blockchain Integration

### Environment Variables

| Variable | Description |
|---|---|
| `VITE_BLOCKCHAIN_RPC_URL` | Ethereum/Polygon RPC endpoint |
| `VITE_CHAIN_ID` | Network chain ID (e.g., 137 for Polygon) |
| `VITE_TOKEN_CONTRACT_ADDRESS` | Green Token ERC-20 contract address |
| `VITE_REWARD_CONTRACT_ADDRESS` | Reward distribution contract address |

### How Rewards Work

1. AI Reward Optimization Agent calculates token amount based on report quality/impact.
2. Backend calls smart contract to mint tokens to user's wallet.
3. Transaction hash is stored in `token_transactions` table.
4. Frontend displays balance and transaction history.
5. Users can view transactions on Polygonscan via `tx_hash` links.

---

## Environment Variables Summary

| Variable | Required | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key |
| `VITE_API_BASE_URL` | No | Backend API base URL (defaults to `/api`) |
| `VITE_BLOCKCHAIN_RPC_URL` | No | Blockchain RPC endpoint |
| `VITE_CHAIN_ID` | No | Blockchain network ID |
| `VITE_TOKEN_CONTRACT_ADDRESS` | No | Green Token contract address |
| `VITE_REWARD_CONTRACT_ADDRESS` | No | Reward contract address |
