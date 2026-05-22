# WEDFLIX — Deployment Guide (Google Cloud Run)

Two services, deployed from this one repo:

| Service  | Source folder | What it is            |
|----------|---------------|-----------------------|
| Backend  | `backend/`    | Hono API (Node)       |
| Frontend | `frontend/`   | React SPA (nginx)     |

Each folder has a `Dockerfile` — Cloud Run builds and runs them.

> **There is no `.env` file in production.** The values from `backend/.env`
> are entered as **environment variables on the Cloud Run service**.

---

## 1. Deploy the Backend

GCP Console → **Cloud Run** → **Create Service** → *Continuously deploy from a
repository* → connect the GitHub repo, branch `main`.

- **Build type:** Dockerfile
- **Source / Dockerfile directory:** `/backend`
- **Region:** `asia-south1` (Mumbai — closest to the database)
- **Authentication:** Allow unauthenticated invocations
- **Container port:** `8080`

### Backend environment variables (Variables & Secrets tab)

| Variable | Value |
|---|---|
| `DATABASE_URL` | Supabase pooler connection string (password URL-encoded) |
| `JWT_SECRET` | a 32-byte random hex — `openssl rand -hex 32` |
| `R2_ACCOUNT_ID` | Cloudflare R2 account id |
| `R2_ACCESS_KEY_ID` | R2 access key id |
| `R2_SECRET_ACCESS_KEY` | R2 secret access key |
| `R2_BUCKET` | `wedflix-media` |
| `CORS_ORIGINS` | the frontend URL (set after step 2) |
| `PUBLIC_BASE_URL` | the backend's own Cloud Run URL (set after first deploy) |

The exact values are in `backend/.env` on your machine — copy each one.
**Do not set `PORT`** — Cloud Run provides it.
Secrets (`DATABASE_URL`, `JWT_SECRET`, `R2_SECRET_ACCESS_KEY`) are best stored
in **Secret Manager** and referenced, rather than plain variables.

Deploy → copy the service URL (e.g. `https://wedflix-backend-xxxx.run.app`).
Then edit the service once more, set `PUBLIC_BASE_URL` to that URL, redeploy.

---

## 2. Deploy the Frontend

Cloud Run → **Create Service** → same repo, branch `main`.

- **Dockerfile directory:** `/frontend`
- **Region:** `asia-south1`
- **Authentication:** Allow unauthenticated invocations
- **Container port:** `8080`

### Frontend environment variables

| Variable | Value |
|---|---|
| `API_URL` | `<backend URL>/api/v1` |
| `WEDDING_SLUG` | `bismita-debasish` |

Deploy → copy the frontend URL.

---

## 3. Wire the two together

Go back to the **backend** service → set `CORS_ORIGINS` to the frontend URL →
redeploy.

Done. The frontend is your live site; `/admin` is the admin portal.

---

## Database

The Supabase database is already migrated and seeded. For future schema
changes, run locally against the production `DATABASE_URL`:

```bash
cd backend && npm run db:migrate
```

## Security

Rotate the database password and R2 keys after go-live (they were shared
during setup). Update the Cloud Run variables afterwards.
