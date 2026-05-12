🌱 **EcoChain – AI-Powered Urban Waste Intelligence**

EcoChain is an **agentic AI waste management platform** that turns raw citizen complaints into **verified, geo‑intelligent, reward‑driven actions** for cities.

Citizens report waste with photos and location, AI agents verify and prioritize the report, municipal officers resolve it, and citizens earn **Green Token** rewards only after manual resolution.

---

## 🔗 Live Demo

**Web app (Vercel)**  
`https://green-chain-front-master.vercel.app`

**Backend API (Render)**  
Base URL (used by the frontend): `https://<your-render-service>.onrender.com/api`

> Configure `VITE_API_BASE_URL` on Vercel to point to your Render API `/api` base path.

---

## 🚀 Core Features

### 🤖 Multi‑Agent AI Pipeline
- **Waste Verification Agent**
  - Vision model validates that the image actually contains waste
  - Detects contamination at source (e.g. plastic in organic bin)
  - Detects **internet / stock images** (watermarks, UI chrome, overlays) and auto‑rejects them
- **Geo‑Intelligence Agent**
  - Enriches reports with location data
  - Feeds the `hotspots` table for red / yellow / green zone visualizations
- **Municipal Coordination Agent**
  - Scores severity and routes reports to the right facility type
  - Marks reports as `assigned` for officer workflows
- **Reward Optimization Agent**
  - Suggests a token reward based on severity, AI quality and contamination
  - Stores only a **suggested** reward; no minting happens here
- **Fraud Detection Agent**
  - Detects duplicate / spammy reports near the same coordinates
  - Marks suspicious reports as `rejected` and clears any reward suggestion

### 👮 Municipal Officer & City Dashboards
- City‑wide view of all reports with filters by:
  - Status (`pending`, `verified`, `assigned`, `in_progress`, `resolved`, `rejected`)
  - Severity (low / medium / high / critical)
- One‑click **Resolve** action:
  - Validates the report is not rejected
  - Mints a `token_transactions` record only on resolution
  - Updates report status to `resolved`

### 👤 Citizen Experience
- Email/password auth via **Supabase** with roles:
  - `citizen`, `municipal_officer`, `city_planner`, `admin`
- Report creation flow:
  - Upload or capture photo (camera support)
  - Auto‑detect location or manual entry
  - Choose category & severity + description
- Real‑time AI pipeline status timeline (per report)
- Simple token balance & rewards history (via `token_transactions`)

### 📍 Hotspots (Red / Yellow / Green Zones)
- `public.hotspots` table schema:
  - `id uuid primary key`
  - `area_name text`
  - `latitude double precision`
  - `longitude double precision`
  - `report_count int`
  - `avg_severity numeric`
  - `last_updated timestamptz`
- Frontend visualizes hotspots around the current user as:
  - 🔴 Critical zone (high `report_count` and severity)
  - 🟡 Medium priority
  - 🟢 Low priority

---

## 🧠 High‑Level Architecture

- **Frontend (Web)** – Vite + React + TypeScript + shadcn‑ui  
  Connects to:
  - **Supabase** directly for RLS‑protected data (`reports`, `report_events`, `hotspots`, `token_transactions`, etc.)
  - **Backend API** for AI pipeline and municipal/admin operations

- **Backend (API)** – Express + TypeScript  
  - Validates Supabase JWTs via `requireAuth`
  - Uses Supabase **service role** client for secure server‑side access
  - Implements the AI pipeline stages and municipal routes:
    - `POST /api/reports/:id/process`
    - `POST /api/municipal/reports/:id/assign`
    - `POST /api/municipal/reports/:id/resolve`
    - `GET /api/admin/metrics*`, etc.

- **AI Layer** – OpenAI‑compatible client (e.g. Groq)  
  - Vision + text models for:
    - Waste verification + contamination detection
    - Screenshot/stock image detection
    - Reward optimization and routing heuristics

- **Database & Auth** – Supabase  
  - Postgres with RLS, auth, storage, and typed client
  - Buckets: `report-images` for citizen photos

- **Mobile (optional)** – Expo React Native app (`mobile/`)  
  - Light client for field use (camera + location), talking to the same Supabase project.

---

## 🛠️ Detailed Tech Stack

### Frontend (Web)
- **Vite** + **React 18** + **TypeScript**
- **shadcn‑ui** + **Radix UI** + Tailwind CSS
- **@tanstack/react-query** for data fetching/caching
- **Supabase JS** for auth + database + storage

### Backend
- **Node.js 18+** with **Express**
- **TypeScript** + **Vitest** for tests
- **Supabase JS** (admin + anon clients)
- **pino / pino-http** for structured logging

### Data & AI
- **Supabase Postgres** (RLS‑secured)
- Buckets for image storage
- OpenAI‑compatible API (e.g. Groq) for:
  - Vision model (`AI_VISION_MODEL`)
  - Text model (`AI_TEXT_MODEL`)

### Dev & Infra
- Web hosting: **Vercel** (frontend)
- API hosting: **Render** (backend + Dockerfile)
- Mobile dev: **Expo** / EAS (optional)

---

## 🔧 Local Development

### Prerequisites
- Node.js 18+
- npm
- Supabase project with the required tables and RLS policies

### 1. Configure environment

Root `.env` (frontend):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_API_BASE_URL` (e.g. `http://localhost:3001/api`)

Backend `.env` (`backend/.env`):
- `PORT=3001`
- `API_BASE_PATH=/api`
- `CORS_ORIGIN=http://localhost:5173`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AI_BASE_URL`
- `AI_API_KEY`
- `AI_VISION_MODEL`
- `AI_TEXT_MODEL`

### 2. Run backend

```bash
cd backend
npm install
npm run dev
```

Server: `http://localhost:3001/api`  
Health check: `GET /healthz`

### 3. Run frontend

```bash
cd ..
npm install
npm run dev
```

Vite dev server: `http://localhost:5173`

---

## ✅ Production Deployment

- **Backend (Render)**  
  - Root: `backend/`  
  - Build: `npm install && npm run build`  
  - Start: `npm start`  
  - Port: `3001`  
  - Set all backend `.env` vars in Render dashboard.

- **Frontend (Vercel)**  
  - Framework preset: Vite  
  - Build: `npm run build`  
  - Output: `dist`  
  - Set env vars:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_PUBLISHABLE_KEY`
    - `VITE_API_BASE_URL=https://<render-service>.onrender.com/api`

Ensure `CORS_ORIGIN` on the backend includes your Vercel URL.

---

## 🔍 Hotspots CSV Seeding (example)

To quickly visualize hotspots around a location, you can seed the `hotspots` table using a CSV like:

```csv
area_name,latitude,longitude,report_count,avg_severity
Central Market – Red Zone,22.8210,75.9432,48,3.8
Lake Road – Yellow Zone,22.8195,75.9415,21,2.4
City Park – Green Zone,22.8221,75.9450,8,1.3
Industrial Belt – Critical,22.8255,75.9488,60,4.2
School District – Medium,22.8182,75.9399,17,2.0
```

Import into Supabase with `id`, timestamps auto‑generated, and you’ll immediately see **red/yellow/green** zones near your coordinates.

---

## 🙋 Contributing / Extending

- Plug in different AI providers (just implement the OpenAI‑compatible interface).
- Extend the reward logic to talk to a real on‑chain ERC‑20 contract.
- Add more granular hotspot metrics (per ward/zone, per time‑window).

PRs and ideas are welcome. 🌍✨
# 🌱 EcoChain – AI-Powered Urban Waste Intelligence System

EcoChain is an **Agentic AI-based waste management platform** that transforms traditional complaint systems into an **intelligent, automated decision-making system**.

Instead of just collecting complaints, EcoChain **verifies, analyzes, and prioritizes waste reports in real-time**, enabling faster and smarter urban waste management.

---

## 🔗 Live Demo

🚀 **Access the live application here:**  
👉 https://green-chain-front-master.vercel.app



---

## 🚀 Key Features

### 🤖 AI Waste Verification (Agent-1)
- Uses computer vision to detect and classify waste
- Validates whether the uploaded image contains actual waste
- Filters out fake or irrelevant reports

### ♻️ Smart Segregation & Analysis (Agent-2)
- Identifies waste type (plastic, metal, paper, etc.)
- Provides actionable segregation guidance
- Assigns severity level (Low / Medium / High)

### 📍 Geo-Intelligence (Hotspot Detection)
- Aggregates reports to identify waste hotspots
- Classifies zones into:
  - 🔴 High Priority (Critical)
  - 🟡 Medium Priority
  - 🟢 Low Priority
- Enables smarter municipal response

### 📊 Intelligent Decision Support
- Converts raw complaints into **actionable insights**
- Helps authorities prioritize cleanup tasks
- Reduces manual verification workload

---

## 🧠 System Architecture

User (Camera Scan / Upload)
↓
Agent-1: Waste Verification (AI Model)
↓
Agent-2: Segregation + Severity Analysis
↓
Hotspot Database (Geo-Intelligence)
↓
Visualization (Zones + Insights)

---

## 🛠️ Tech Stack

### Frontend
- React.js
- TypeScript
- Tailwind CSS

### Backend
- Node.js

### Database
- Supabase (Hotspots + Reports)

---