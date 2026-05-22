# WEDFLIX — Deployment Guide (Google Cloud Run)

The whole app deploys as **one Cloud Run service** from **one Dockerfile at
the repo root**. The Node/Hono backend serves the API *and* the React
website — same origin, one URL.

> There is no `.env` file in production. The values from `backend/.env` are
> entered as **environment variables on the Cloud Run service**.

---

## Deploy

GCP Console → **Cloud Run** → **Create Service** → *Continuously deploy from
a repository* → connect `trymukeshranjan-arch/wedflix`, branch `main`.

- **Build type:** Dockerfile
- **Dockerfile location / directory:** `/` (repo root — the default)
- **Region:** `asia-south1` (Mumbai)
- **Authentication:** Allow unauthenticated invocations
- **Container port:** `8080`

### Environment variables (Variables & Secrets tab)

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | ✅ | Supabase pooler connection string |
| `JWT_SECRET` | ✅ | 32-byte random hex (`openssl rand -hex 32`) |
| `R2_ACCOUNT_ID` | for uploads | Cloudflare R2 account id |
| `R2_ACCESS_KEY_ID` | for uploads | R2 access key id |
| `R2_SECRET_ACCESS_KEY` | for uploads | R2 secret access key |
| `R2_BUCKET` | for uploads | `wedflix-media` |

All values are in `backend/.env` on your machine — `cat backend/.env` and
copy them. **Do not set `PORT`** — Cloud Run provides it. `NODE_ENV` and
`WEB_ROOT` are already set by the Dockerfile.

Deploy → Cloud Run gives you a URL like `https://wedflix-xxxx.run.app`.
That single URL **is the site**; `/admin` is the admin portal.

That's it — no CORS setup, no second service, no URL wiring.

---

## Notes

- **Database** is already migrated and seeded. For future schema changes,
  run `cd backend && npm run db:migrate` against the production `DATABASE_URL`.
- If the build can't find the Dockerfile, the trigger's *Dockerfile
  directory* must be `/` (root), not a subfolder.
- Rotate the database password and R2 keys after go-live, then update the
  Cloud Run variables.
