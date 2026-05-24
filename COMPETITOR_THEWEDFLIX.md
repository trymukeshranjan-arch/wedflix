# Competitor Study — thewedflix.com

Studied via Chrome MCP on the live site `https://www.thewedflix.com/`.

> ⚠️ Legal note (FYI, not actionable for us): their site embeds the literal Netflix wordmark + the red "N" logo as their own branding (in nav, on every card watermark, and on detail pages). That is a textbook trademark issue on their end — they will get takedowns sooner or later. We deliberately use our own brand. Mention here just so you're aware they're cutting that corner.

---

## 1 · Architecture

| | thewedflix.com | our wedflix |
|---|---|---|
| Stack signal | Next.js / React (Tailwind classes, z-[99999], SPA route transitions) | React + Vite + Hono |
| Routing pattern | `/main/home`, `/main/seasons`, `/main/more-info`. `/home` and `/seasons` separate (likely marketing landing). | `/w/:slug/...`, `/admin/...` — multi-tenant by slug |
| Video storage | Cloudflare R2 (`pub-7dce21a64db74bc09ed8619b11a1fad4.r2.dev`) | Cloudflare R2 (presigned reads) |
| Multi-tenancy | Single wedding per deployment (URL has no slug) | Multi-wedding per studio, slug routed |
| Custom domain | thewedflix.com root | wedflix.qpix.co.in (just shipped) |
| Tech corners cut | Some nav items are placeholders (`#`), `/main/films` is 404 | All advertised features live |

**Takeaway:** they are likely a single-wedding template; we already have multi-tenant infra they don't.

---

## 2 · User-facing features observed

### 2.1 Pre-portal flow
- **Preloader video** plays before "Who's watching?" (an MP4 file at `/assets/movie/preloder-desktop.mp4`). Two stacked black overlays with `z-99998` / `z-99999`. They use a real video file, not SVG.
- **"Who's watching?" picker** — 4 red rounded-square avatars with smiley SVGs and names below ("Mrunal / Anirudh / Family / Friends"). Identical pattern to ours.

### 2.2 Home (`/main/home`)
- **Top nav**: Home · Seasons · Our Films · Little Moments. "Our Films" and "Little Moments" are dead links (no real pages yet).
- **Profile avatar** top-right with dropdown arrow.
- **Hero**:
  - Background video autoplays muted, looping.
  - "A WEDDING ORIGINAL" badge.
  - Couple names rendered in a custom calligraphic display font ("Mrunal ∞ Anirudh"), large.
  - **"TOP 10" red badge + ranking line** ("#1 ...") — a fun touch we don't have.
  - Description paragraph + 3 inline tags (Celebration / Family / Romance) separated by bullets.
  - Play + More Info buttons (same shape as ours).
  - Floating mute/unmute toggle bottom-right.
- **Content rows**:
  - **"The Celebration Series"** — landscape cards with stylized title overlay ("Pure Celebration / Season 1", "Lights Come Alive / Season 2", etc.).
  - **"OUR FILM"** — portrait/poster cards (16:9 vertical) with title text rendered in calligraphy on the card itself ("Pre-Wedding Film", "The Proposal", "Highlight of the wedding").
  - **"Unscripted Moments"** — portrait poster cards ("Candid Memories", "Family Fun", "Emotional Moments").
- Cards render the calligraphic title **as text on the image** — not separate metadata. So they probably bake titles into the poster art.

### 2.3 Seasons detail page (`/main/seasons`)
This is the most differentiated feature. Acts as a Netflix-style "Title page":
- Large hero image (the wedding's banner).
- Back arrow top-left.
- Title block: brand logo + "A WEDDING ORIGINAL" + couple names + Play / More Info.
- **Metadata strip**: `2026 · 3 Seasons · HD`.
- Tagline / description paragraph.
- **"Starring:" line** — cute wedding take on the credits: "The Bride · The Groom · Families · Friends · Forever".
- **Episodes section**:
  - "Episodes" heading + **Season dropdown** ("Season 1" selector, presumably toggles to 2 / 3).
  - Per-season subtitle line: `Season 1: The Kickoff — Haldi` + content-rating badge (`U/A 16+`) + language label.
  - Episode list rows:
    - Landscape thumbnail
    - Episode title (e.g. "Pure Celebration")
    - 1-line description
    - Duration (`1m`)
    - **Download icon per episode**

### 2.4 More Info page (`/main/more-info`)
Long-scroll cinematic credits-roll layout (not a modal):
- "A **WEDFLIX** WEDDING ORIGINAL" — big red wordmark.
- "BRIDE / Mrunal" with custom calligraphic font.
- "∞" symbol.
- "GROOM / Anirudh".
- Movie-credits framing: "Based on a True Love Story", "Directed By: …", "Produced By: …", "Grateful for every heart…", "Now Streaming — Forever ♾️".
- Floating mute toggle bottom-right (suggests a background music/video on this page too).

### 2.5 Other observations
- Mute toggle is consistent and floats on every page that has background media.
- Loading skeleton shimmer on route transitions (good UX detail).
- Dark mode only.

---

## 3 · Feature gap map (us vs them)

| Feature | thewedflix.com | our wedflix | Action item |
|---|---|---|---|
| Profile picker ("Who's watching") | ✅ | ✅ | parity |
| Auto-playing hero | ✅ | ✅ | parity |
| Content rows (horizontal scroll) | ✅ | ✅ | parity |
| Cards with hover preview | ✅ | ✅ (video card autoplay on hover) | parity |
| Multi-tenant / multi-wedding | ❌ single | ✅ studio + N weddings | ahead |
| Custom domain mapping | ✅ (root) | ✅ (subdomain) | parity |
| Per-wedding theme/branding customisation | ❌ | ✅ (just shipped) | **ahead** |
| Search | unknown — not visible in nav | ✅ | likely ahead |
| Admin portal with inline edit | unknown (no admin link visible) | ✅ | likely ahead |
| Video upload (chunked, large files) | unknown | ✅ (multipart to R2) | likely ahead |
| **Seasons grouping with dropdown** | ✅ | ❌ (we have "rows" only) | **GAP** |
| **Per-episode download button** | ✅ | ⚠ download endpoint exists, no UI surfacing | **GAP (UI)** |
| **Metadata badges** (year · seasons · HD · rating) | ✅ | ❌ | **GAP** |
| **"Starring" / credits field** | ✅ | ❌ | **GAP** |
| **TOP 10 ranking badge on hero** | ✅ | ❌ | nice-to-have |
| **More Info as cinematic credits page** | ✅ (separate route) | ❌ (we don't even open it) | **GAP** |
| **Preloader/intro animation** | ✅ (video file) | partial (silent SVG, currently reverted on live) | open question |
| Calligraphic titles baked on poster art | ✅ | ❌ (text rendered as overlays) | design choice |

---

## 4 · Concrete recommendations (ranked by ROI)

### High impact

1. **Seasons grouping + dropdown** (matches our existing `seasons` table — already there in schema, just no UI). Add:
   - Admin: assign content items to a season.
   - User: a `/w/:slug/seasons` route that renders title page with season dropdown + episode list.
   - Reuse our `Season` schema (already has number, title, description).
2. **Title-page / Detail-page** (clicking "More Info" should open a cinematic detail page with metadata, cast, episodes — like Netflix titles).
3. **Metadata fields on content** (year, runtime label, rating, HD/4K badge). Extend `contentItems` or `weddings` table.
4. **"Starring" / Credits field** on the wedding — wedding-specific take: bride, groom, families, special mentions. Goes on the title page.

### Medium impact

5. **Per-episode download button** in the row UI (we have the endpoint, no UI). One-click in row, no modal.
6. **TOP 10 ranking badge** on hero (visual flourish — admin sets the rank).
7. **Cinematic "Credits" page** like their More Info — feels very wedding-appropriate.

### Low impact / opinionated skip

8. Their "calligraphy on poster" approach — looks great but means every card needs a pre-rendered image with text. We render titles separately in the DOM, which is more flexible. Skip.
9. Preloader video — we already have an SVG version on standby. If you want a real video file later, we have the path.

---

## 5 · What we should NOT copy

- Their Netflix logo + wordmark usage — that's a trademark landmine.
- Their "Our Films" / "Little Moments" dead-link nav — confusing UX.
- Single-wedding architecture — we're already past that.

---

## 6 · Quick wins for next session

Pick from this list, I'll engineer in order:

- **A.** Title page (cinematic credits-style "More Info" page with metadata, starring, season list).
- **B.** Seasons grouping UI (admin assigns items to season + user-side season dropdown).
- **C.** Metadata badges on hero (year · runtime · HD).
- **D.** Per-episode download button on cards/episode list.
- **E.** TOP 10 ranking badge on hero (admin sets a rank number).

A + B together give us Netflix Title Page parity — biggest visual leap.
