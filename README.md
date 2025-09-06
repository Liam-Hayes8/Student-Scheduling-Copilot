# Student Scheduling Copilot

A sophisticated web application that enables students to manage their schedules using natural language commands. The system intelligently parses requests, handles conflicts, and integrates with Google Calendar while maintaining enterprise-grade security and auditability.

## Problem Statement

Students struggle with complex scheduling scenarios involving multiple constraints, recurring events, and conflict resolution. Traditional calendar apps require manual input for each event, making it difficult to handle requests like "block 7–9pm Tu/Th for EE labs; avoid Fridays; add all midterm dates from my syllabus PDF; resolve conflicts with my work shifts."

The Student Scheduling Copilot solves this by combining natural language processing with RAG (Retrieval-Augmented Generation) to automatically extract and schedule events from course syllabi, while providing intelligent conflict resolution and audit trails.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │  External APIs  │
│   (Next.js)     │◄──►│ (Node/Express)  │◄──►│ (Google Cal)    │
│                 │    │                 │    │                 │
│ • Auth (OAuth)  │    │ • Planner       │    │ • Calendar      │
│ • UI Components │    │ • LLM Orch.     │    │ • OpenAI        │
│ • State Mgmt    │    │ • Calendar Agent│    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                               │
                       ┌─────────────────┐
                       │   Storage       │
                       │                 │
                       │ • Postgres      │
                       │ • pgvector      │
                       │ • Redis         │
                       └─────────────────┘
```

### Core Services

1. **Planner**: Converts natural language goals into structured event plans
2. **LLM Orchestrator**: Uses OpenAI function calling for constraint extraction and plan generation
3. **Calendar Agent**: Pure API client for conflict detection and calendar operations
4. **RAG Service**: PDF syllabus parsing with vector embeddings for intelligent event extraction

### Technology Choices

- **Frontend**: Next.js with TypeScript (React ecosystem, SSR, auth integration)
- **Backend**: Node.js/Express (JavaScript consistency, rapid development)
- **Database**: PostgreSQL with pgvector (ACID compliance, vector search for RAG)
- **Cache**: Redis (session management, rate limiting)
- **AI**: OpenAI GPT-4o (function calling, JSON mode) + optional Ollama for local mode
- **Auth**: Google OAuth with calendar.events scope (principle of least privilege)

## Security & Privacy

- **Encrypted token storage** with secure session management
- **Scoped service accounts** with minimal required permissions
- **Server-side API calls only** - no client-side calendar access
- **Full audit logging** of every proposed and executed change
- **Schema validation** and input sanitization at all endpoints

## Quick Setup

1. Clone the repository
2. Install dependencies: `npm install` (root), `cd frontend && npm install`, `cd api && npm install`
3. Set up environment variables (see `.env.example`)
4. Start development: `npm run dev` (starts both frontend and backend)
5. Open [http://localhost:3000](http://localhost:3000)

### Key Features Demo

**Natural Language Scheduling:**
- "Study sessions 7-9pm Tu/Th, avoid my work shifts"
- "Block 2 hours every morning for calculus homework"
- "Schedule gym sessions 3x per week, prefer evenings"

**Syllabus RAG Parser:**
- Upload PDF syllabus → automatic exam/assignment extraction
- Search extracted events: "find all midterms"
- Bulk import to calendar with conflict detection
- Course information extraction (instructor, semester, etc.)

## Development

### Project Structure
```
/
├── frontend/          # Next.js application
│   ├── components/    # Reusable UI components
│   ├── pages/         # Next.js pages and API routes
│   ├── services/      # Client-side API helpers
│   └── styles/        # CSS modules and global styles
├── api/               # Backend Express application
│   ├── modules/       # Core business logic
│   │   ├── planner/   # Event planning logic
│   │   ├── llm/       # LLM orchestration
│   │   └── calendar/  # Google Calendar integration
│   ├── migrations/    # Database schema
│   └── tests/         # Unit and integration tests
├── docs/              # Architecture and API documentation
└── docker/            # Container configurations
```

## Test Matrix

| Component | Metric | Target |
|-----------|--------|--------|
| Event Extraction | Accuracy | >90% |
| Conflict Resolution | Quality Score | >85% |
| Calendar Writes | Success Rate | >99% |
| Response Time | Median Latency | <2s |
| Cost | Per Request | <$0.05 |

## Deployment

- **Frontend**: Vercel (optimized for Next.js)
- **Backend**: Google Cloud Run (serverless, auto-scaling)
- **Database**: PostgreSQL on Google Cloud SQL
- **Cache**: Redis on Google Memory Store

## Demo Script (90 seconds)

1. **Login** - Google OAuth with calendar scope
2. **Natural Language Input** - "Study sessions 7-9pm Tu/Th, avoid my work shifts"
3. **Constraint Detection** - System identifies existing conflicts
4. **Plan Generation** - Proposes 3 ranked alternatives
5. **Conflict Resolution** - Shows why each time slot was chosen
6. **Syllabus Upload** - Upload PDF, extract exam dates automatically
7. **Event Import** - Select and import syllabus events to calendar
8. **Confirmation** - User approves, events written to calendar
9. **Audit Trail** - Shows logged changes with original prompt

## License

MIT License - see LICENSE file for details.

## Up-to-date Quick Reference (2025-09)

### Current project structure
```
/frontend/src/app            # Next.js App Router (API routes in here)
/frontend/src/lib            # NextAuth config and helpers
/api/src                     # Express API (prod), Cloud Run port 8080
/simple-server.js            # Demo API (dev), port 3006
/docker-compose.yml          # Local dev with Postgres + Redis + API + Frontend
```

### Dev ports
- Frontend dev: http://localhost:3004 (via `frontend` scripts)
- Demo API: http://localhost:3006 (used when NEXT_PUBLIC_DEMO_MODE is not "false")
- Express API (prod build): 8080 (Cloud Run); 3001 when running locally via docker-compose

### Modes
- Demo mode (default): Uses the demo API for planner/syllabus/calendar so you can run without Google credentials. Controlled by `NEXT_PUBLIC_DEMO_MODE`.
- Real mode: Set `NEXT_PUBLIC_DEMO_MODE=false` to call Google Calendar and your real backend.

### Frontend env (.env.local)
```
NEXT_PUBLIC_DEMO_MODE=true           # omit or set to true for demo; set to false for real
NEXTAUTH_URL=http://localhost:3004   # your deployed URL on Vercel in prod
NEXTAUTH_SECRET=your-long-random-secret
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
NEXT_PUBLIC_API_URL=https://your-api.example.com   # only used in real mode for non-Google endpoints
```

### Backend env (.env)
```
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
OPENAI_API_KEY=sk-...
FRONTEND_URL=https://your-frontend-domain
GOOGLE_CLIENT_ID=xxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxxxxx
```

### Google OAuth: who can sign in?
- To allow anyone with a Google account to sign in:
  1) In Google Cloud Console → OAuth consent screen, set User Type to External.
  2) Set App status to In production.
  3) Add authorized redirect URI: `http(s)://YOUR_DOMAIN/api/auth/callback/google` (and `http://localhost:3004/api/auth/callback/google` for local dev).
  4) Enable the Google Calendar API for the same project.
- If App status is In testing, only users you add as Test users can sign in.

### Fix "Request had invalid authentication credentials" when creating events
1) Ensure you are in real mode: `NEXT_PUBLIC_DEMO_MODE=false` (otherwise calendar writes are mocked).
2) Confirm the OAuth project has Calendar API enabled and the redirect URI matches your site URL.
3) Make sure the scope includes `https://www.googleapis.com/auth/calendar.events` (already configured).
4) Revoke old access to force re-consent with the correct scope: https://myaccount.google.com/permissions → remove the app → sign in again.
5) Set `NEXTAUTH_URL` to your exact site origin (including https in prod) and set a strong `NEXTAUTH_SECRET`.
6) In Vercel, define the same env vars for the Production environment and redeploy.

### Local development
- Demo: `npm run dev` (frontend on 3004, demo API on 3006). You can exercise all flows without Google credentials.
- Real: Create `frontend/.env.local` with real values and start only the frontend (`npm run dev:frontend`). For backend, run the Express API separately or deploy it (Railway/Cloud Run) and set `NEXT_PUBLIC_API_URL`.

### Deploy
- Frontend: Vercel (root = `frontend`). Set env vars from "Frontend env".
- Backend: Railway (simple) or Cloud Run (see DEPLOYMENT_PRODUCTION.md).
