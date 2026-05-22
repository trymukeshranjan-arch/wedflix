# WEDFLIX Backend

Multi-tenant cinematic wedding-memory streaming API.

- **Runtime:** Node.js + TypeScript, run with `tsx`
- **Framework:** Hono
- **Database:** any PostgreSQL, via Drizzle ORM
- **Auth:** self-hosted — admin email/password login, invite links, JWT sessions
- **Media:** Cloudflare R2 for video + photos, streamed back through the
  `/api/v1/media` route (HTTP Range supported). Falls back to a local
  `uploads/` folder when R2 is not configured.

## Getting started

```bash
cd backend
cp .env.example .env          # set DATABASE_URL + JWT_SECRET
npm install
npm run db:generate           # generate SQL migrations from the schema
npm run db:migrate            # apply them to the database
npm run db:seed               # load the "Bismita ∞ Debasish" demo wedding
npm run dev                   # start on http://localhost:8787
```

`db:seed` also creates an admin login — `admin@wedflix.test` / `admin123`.
Health check: `GET /health`.

## Multi-tenancy

Every wedding is a tenant, resolved per request from:

1. `X-Wedding-Slug` header (local dev / the admin portal)
2. a custom domain
3. a subdomain of `ROOT_DOMAIN` (`bismita-debasish.wedflix.com`)

For local testing, send `X-Wedding-Slug: bismita-debasish` with every request.

## API surface (`/api/v1`)

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/login` | admin email + password → session token |
| GET | `/auth/me` | current user + memberships |
| GET | `/wedding` | public wedding / branding info |
| GET | `/wedding/home` | hero + content rows (one call) |
| GET | `/wedding/seasons` | seasons + episodes |
| GET | `/wedding/memory` | anniversary "on this day" feed |
| POST | `/wedding/join` | accept an invite → viewer session |
| GET | `/content/search?q=` | search |
| GET | `/content/:id` | detail + people tagged |
| GET | `/content/:id/playback` | playback URL (signed in production) |
| GET | `/content/:id/download` | original file (download permission) |
| PUT | `/engagement/content/:id/progress` | continue watching |
| GET | `/engagement/continue-watching` | resume list |
| POST | `/engagement/content/:id/like` | toggle like |
| GET/POST | `/engagement/content/:id/comments` | comments |
| GET | `/media/:assetId` | stream an uploaded media file (R2-backed) |
| POST | `/admin/media/upload` | upload a video / image (multipart) → R2 |
| GET | `/admin/home` | hero + rows incl. drafts (inline-edit admin) |
| GET | `/admin/content` | list all content (incl. drafts) |
| POST/PATCH/DELETE | `/admin/content` | manage content |
| PATCH | `/admin/wedding` | edit couple names / tagline |
| GET/POST | `/admin/seasons` | manage seasons |
| POST | `/admin/invites` | create an invite link |

## Testing

```bash
npm test
```

Runs the end-to-end API suite (`src/test/api.test.ts`) — 38 cases across
auth, tenant resolution, wedding home, content, admin CRUD, authorization,
invites, media upload, validation and content visibility. The tests drive the
real Hono app in-process (no network) against a local Postgres `wedflix`
database, which is re-seeded before the run.

## Notes

- Media uploads go to Cloudflare R2 (or the local `uploads/` folder when R2
  is not configured) and are streamed back via `GET /api/v1/media/:assetId`,
  which forwards HTTP Range requests so video seeking works.
- `GET /content/:id/playback` returns that media URL — there is no separate
  video-streaming provider.
- `db/schema/` is the source of truth; never hand-edit generated migrations.
