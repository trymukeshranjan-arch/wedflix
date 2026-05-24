# Engineering plan — Intro video + Seasons & Episodes UI

Status: **draft for approval**, not yet implementing.

Scope splits cleanly in two; I'll ship them in order so each one can be verified live before the next.

---

## Phase 1 — Intro video integration

### What the user gave us
- File: `Netflix_W_Logo_Animation.mp4` (the user named it; I'm treating it purely as a media asset the user has authorised me to host).
- Specs: 1920×1080, H.264, **4.04 s**, 24 fps, AAC audio, **752 KB**.

Small enough to bundle directly into the frontend — no need to push it to R2 or add a video-asset table.

### Where it plays
Same point in the flow as thewedflix.com: **before "Who's watching?"**. Plays once per browser session (sessionStorage gates re-plays). Skippable any time.

### Replacing the SVG intro
We already have:
- `frontend/src/app/user/IntroAnimation.tsx` — the SVG/CSS version
- `frontend/src/app/user/WeddingApp.tsx` — gates `introDone` via sessionStorage

I'll **rewrite IntroAnimation** to render an HTML5 `<video>` element pointed at `/intro.mp4` instead of the SVG. WeddingApp stays the same.

### Autoplay & sound — the tricky bit
Browsers block `autoplay` with sound unless the user has interacted with the page. Standard solutions:

| Approach | Pros | Cons |
|---|---|---|
| **A. Try sound, fall back to muted + visible unmute button** (Recommended) | Sound works when possible, never blocks the experience | Some users see muted intro the first time |
| B. Splash "▶ Tap to enter" before the video | Sound always works | One extra tap, more friction |
| C. Muted always | Simple | Defeats the point of the audio track |

I'll do **A**. Logic:
```
1. video.muted = false; play()
2. If play() rejects (autoplay-blocked): video.muted = true; play() again
3. Show an unmute button when muted; click toggles to sound (counts as user gesture)
```

### Files touched (Phase 1)
| File | Change |
|---|---|
| `frontend/public/intro.mp4` | **new** — the video file, copied in |
| `frontend/src/app/user/IntroAnimation.tsx` | rewrite — `<video>` element + autoplay fallback + skip button |
| `frontend/src/app/user/WeddingApp.tsx` | no change |

Bundle size impact: +752 KB in the static-assets folder. Loaded once, cached.

### Edge cases I will handle
- `video.onended` triggers `onDone` — no more SVG keyframe timer.
- `video.onerror` triggers `onDone` immediately so a broken file doesn't trap the user.
- Skip button still calls onDone (covers "I don't want the intro").
- Click anywhere on the stage = skip (matches current behaviour).
- Tab switched away mid-intro → video pauses, resumes when visible. Acceptable for a 4s clip.

### How I'll verify before declaring done
1. Local build → `npx vite build` succeeds; asset bundled in `dist/`.
2. Local preview → intro plays, ends, transitions to Who's Watching cleanly.
3. Skip → goes straight to Who's Watching.
4. Reload in same tab → intro skipped (session gate).
5. Incognito reload → intro plays again.
6. Deploy → verify on `https://wedflix.qpix.co.in/` in fresh incognito.

---

## Phase 2 — Seasons & Episodes UI

Inspired by thewedflix.com's `/main/seasons` page. Functional only — no copying of their text, layout, or branding.

### What already exists (don't rebuild)
- `seasons` table in our schema: `{ id, weddingId, number, title, description, coverUrl }`.
- `contentItems.seasonId` column already exists.
- `GET /api/v1/wedding/seasons` already returns 1 season with 5 episodes (covered by existing E2E test).
- `GET /api/v1/admin/seasons` and `POST /api/v1/admin/seasons` already implemented (saw them in admin.routes.ts).

### What we need to add

**Backend**
| Route | Status |
|---|---|
| `GET /wedding/seasons` | ✅ exists, returns episodes nested |
| `GET /admin/seasons` | ✅ exists |
| `POST /admin/seasons` | ✅ exists |
| `PATCH /admin/seasons/:id` | **add** — edit number/title/description |
| `DELETE /admin/seasons/:id` | **add** — also un-assigns content items (set seasonId = null) |
| `PATCH /admin/content/:id` accepts `seasonId` | likely already accepts — verify; allow null to unassign |

**Schema additions (one tiny migration)**
- `weddings.starring text` — optional "Starring:" line (e.g. "Bride · Groom · Family · Friends"). Shown on the seasons title-page header.
- That's it. Everything else fits existing tables.

**Frontend — admin**
| File | Change |
|---|---|
| `frontend/src/app/admin/SeasonsModal.tsx` | **new** — list/add/edit/delete seasons. Modal pattern matches ProfilesModal. |
| `frontend/src/app/admin/AdminPortal.tsx` | add "Seasons" button to nav (Calendar icon) + mount modal |
| `frontend/src/app/admin/ContentEditModal.tsx` | add "Season" dropdown — assigns content to a season; "(none)" option to unassign |
| `frontend/src/app/admin/WeddingInfoModal.tsx` | add "Starring" text input |

**Frontend — user**
| File | Change |
|---|---|
| `frontend/src/app/user/SeasonsPage.tsx` | **new** — title-page layout |
| `frontend/src/app/App.tsx` | add route `/w/:slug/seasons` → SeasonsPage |
| `frontend/src/app/user/UserPortal.tsx` | nav "Seasons" link → `/w/:slug/seasons` (currently dead `#`) |

### SeasonsPage layout (functional, our own visual style)
```
┌───────────────────────────────────────────────────────────┐
│ ← back                                       👤 Profile    │  Nav (existing)
├───────────────────────────────────────────────────────────┤
│  [ Hero image — uses hero content's thumbnail ]            │
│                                                            │
│     A Wedding Original                                     │
│     Bismita ∞ Debasish                                     │
│     ▶ Play     ⓘ More Info                                 │
│                                                            │
│  2024 · 3 Seasons · HD                                     │
│                                                            │
│  <tagline paragraph>                                       │
│  Starring: Bride · Groom · Families · Friends              │
├───────────────────────────────────────────────────────────┤
│  Episodes                              [ Season 1 ▼ ]      │
│  Season 1: The Kickoff                                     │
│                                                            │
│  ┌────────┐  1. Pure Celebration              12:00  ⬇    │
│  │ [thumb]│  Blessings, happiness, traditions…             │
│  └────────┘                                                │
│  ┌────────┐  2. Laughter Everywhere           08:30  ⬇    │
│  │ [thumb]│  Endless giggles shared…                       │
│  └────────┘                                                │
│  …                                                         │
└───────────────────────────────────────────────────────────┘
```

- Hero image: from `home.hero?.thumbnail` (already on home data).
- Year: derived from `wedding.weddingDate` (if null, just hide the badge).
- Season count: `seasons.length`.
- "HD" badge: static for now.
- Season dropdown: switches the episode list inline (no route change).
- Click episode row → opens the existing `VideoPlayer`.
- Download icon: links to `/api/v1/content/:id/download` (endpoint already exists, behind "download" permission).

### Edge cases I will handle
- **No seasons defined** → show empty state "No seasons yet. The admin can group videos into seasons from the admin portal."
- **Season with no episodes** → "No episodes in this season yet."
- **Anonymous user clicking download** → server returns 403 (existing behaviour); frontend shows a small "Sign in to download" message instead of crashing.
- **Deleting a season** → content items get `seasonId = null`, stay alive in the regular rows on the home page. Confirm dialog warns "Episodes will return to the home rows" before deleting.
- **Wedding has no hero content** → page falls back to a plain dark banner (same pattern as current empty hero).
- **Content item in 2 places** (a season AND a homepage row) — fine, allowed; the home page row keeps showing it.

### Tests (extend `api.test.ts`)
- `PATCH /admin/seasons/:id` updates title; returns 404 on unknown.
- `DELETE /admin/seasons/:id` un-assigns content (verify `seasonId` is null after).
- `PATCH /admin/content/:id` with `seasonId: null` unassigns.
- `PATCH /admin/wedding` with `starring` updates the field; null clears it.
- `GET /wedding/seasons` includes a draft season's episodes only on the admin endpoint (drafts not leaking publicly).

Plus the existing 71 tests must still pass.

### How I'll verify before declaring done
1. Backend: `npm test` → 71 + new tests all green.
2. Local: build clean.
3. Local QA:
   - Create a season in admin → it appears in the dropdown.
   - Assign an episode to it → episode disappears from "no season" view and appears in the season list.
   - Visit `/w/:slug/seasons` → page renders, hero shows, dropdown switches, click play opens video player.
   - Delete a season → episodes return to home rows.
4. Deploy to live.
5. Live smoke test on `https://wedflix.qpix.co.in/`.

---

## What I am NOT doing in this round (deferred)

- Cinematic "More Info" / credits-roll page (Option A from competitor study) — separate feature, holler when you want it.
- TOP 10 ranking badge — small visual flourish, skip.
- "Calligraphic titles baked on poster art" — design change, not engineering.
- Per-wedding intro video (using each wedding's own MP4) — for now ONE global intro for the whole platform.

---

## Order of execution

1. **Phase 1 deploy** — verify intro plays live with sound (or graceful fallback).
2. **Phase 2 backend** — migration + routes + tests, deploy.
3. **Phase 2 frontend** — admin first (so you can set up seasons), then user-facing SeasonsPage.
4. **Phase 2 deploy** — final verify.

Three deploys total. Each independently revertible.

---

## Time estimate

| | Effort |
|---|---|
| Phase 1 (intro video) | ~45 min including deploy and live verify |
| Phase 2 backend (migration + routes + tests) | ~1 hour |
| Phase 2 admin UI (SeasonsModal + ContentEditModal changes) | ~1 hour |
| Phase 2 user SeasonsPage | ~1.5 hours |
| **Total** | **~4 hours of work, 3 deploys** |

---

## Questions before I start

1. Confirm I should use the provided MP4 as the global intro for every wedding (not per-wedding).
2. Confirm "Phase 1 first, then Phase 2" is the right order (vs do all at once and ship in one deploy).
3. Confirm I should NOT add a "Starring" admin field if you don't want it — it's the smallest thing to drop.
