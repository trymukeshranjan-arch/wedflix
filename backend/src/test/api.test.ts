import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { app } from "../app";
import { closeDb } from "../db/client";
import { seedDatabase } from "../db/seed";

const SLUG = "bismita-debasish";

interface CallResult {
  status: number;
  json: any;
  data: any;
  error: any;
}

interface CallOpts {
  method?: string;
  body?: unknown;
  token?: string;
  slug?: string | null;
  formData?: FormData;
}

// Drives the real Hono app in-process — no network, no running server.
async function call(path: string, opts: CallOpts = {}): Promise<CallResult> {
  const headers: Record<string, string> = {};
  if (opts.slug !== null) headers["X-Wedding-Slug"] = opts.slug ?? SLUG;
  if (opts.token) headers["Authorization"] = `Bearer ${opts.token}`;

  let body: string | FormData | undefined;
  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }

  const res = await app.request(`/api/v1${path}`, {
    method: opts.method ?? "GET",
    headers,
    body,
  });
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    /* no body */
  }
  return { status: res.status, json, data: json?.data, error: json?.error };
}

async function loginAdmin(): Promise<string> {
  const r = await call("/auth/login", {
    method: "POST",
    body: { email: "admin@wedflix.test", password: "admin123" },
  });
  return r.data.accessToken as string;
}

let adminToken = "";

before(async () => {
  await seedDatabase();
  adminToken = await loginAdmin();
});

after(async () => {
  await closeDb();
});

// ─────────────────────────────────────────────────────────────────────────────
describe("health", () => {
  it("GET /health returns ok", async () => {
    const res = await app.request("/health");
    assert.equal(res.status, 200);
    const j: any = await res.json();
    assert.equal(j.status, "ok");
  });

  it("unknown route returns a 404 envelope", async () => {
    const res = await app.request("/api/v1/nope");
    assert.equal(res.status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("auth", () => {
  it("rejects a wrong password", async () => {
    const r = await call("/auth/login", {
      method: "POST",
      body: { email: "admin@wedflix.test", password: "wrong" },
    });
    assert.equal(r.status, 401);
  });

  it("logs in with the correct password", async () => {
    const r = await call("/auth/login", {
      method: "POST",
      body: { email: "admin@wedflix.test", password: "admin123" },
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.accessToken);
  });

  it("rejects an unknown email", async () => {
    const r = await call("/auth/login", {
      method: "POST",
      body: { email: "ghost@wedflix.test", password: "admin123" },
    });
    assert.equal(r.status, 401);
  });

  it("/auth/me requires a token", async () => {
    const r = await call("/auth/me");
    assert.equal(r.status, 401);
  });

  it("/auth/me returns the user and memberships", async () => {
    const r = await call("/auth/me", { token: adminToken });
    assert.equal(r.status, 200);
    assert.equal(r.data.user.email, "admin@wedflix.test");
    assert.ok(Array.isArray(r.data.memberships));
    assert.ok(r.data.memberships.length >= 1);
  });

  it("rejects a garbage token", async () => {
    const r = await call("/auth/me", { token: "not-a-real-jwt" });
    assert.equal(r.status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("tenant resolution", () => {
  it("unknown wedding slug → 404 tenant_not_found", async () => {
    const r = await call("/wedding", { slug: "no-such-wedding" });
    assert.equal(r.status, 404);
    assert.equal(r.error.code, "tenant_not_found");
  });

  it("valid slug → public wedding info", async () => {
    const r = await call("/wedding");
    assert.equal(r.status, 200);
    assert.equal(r.data.slug, SLUG);
    assert.ok(r.data.coupleNameA);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("wedding home", () => {
  it("returns a hero and 4 content rows", async () => {
    const r = await call("/wedding/home");
    assert.equal(r.status, 200);
    assert.ok(r.data.hero, "hero should be present");
    assert.equal(r.data.rows.length, 4);
  });

  it("has 20 items across the rows", async () => {
    const r = await call("/wedding/home");
    const total = r.data.rows.reduce(
      (n: number, row: any) => n + row.items.length,
      0,
    );
    assert.equal(total, 20);
  });

  it("hero exposes a preview URL", async () => {
    const r = await call("/wedding/home");
    assert.ok(r.data.hero.preview);
  });

  it("seasons returns 1 season with 5 episodes", async () => {
    const r = await call("/wedding/seasons");
    assert.equal(r.status, 200);
    assert.equal(r.data.length, 1);
    assert.equal(r.data[0].episodes.length, 5);
  });

  it("memory feed is an array", async () => {
    const r = await call("/wedding/memory");
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("content", () => {
  let sampleId = "";

  before(async () => {
    const home = await call("/wedding/home");
    sampleId = home.data.rows[0].items[0].id;
  });

  it("content detail returns metadata + people", async () => {
    const r = await call(`/content/${sampleId}`);
    assert.equal(r.status, 200);
    assert.ok(r.data.title);
    assert.ok(Array.isArray(r.data.people));
  });

  it("unknown content id → 404", async () => {
    const r = await call("/content/00000000-0000-0000-0000-000000000000");
    assert.equal(r.status, 404);
  });

  it("playback returns a src (dev fallback)", async () => {
    const r = await call(`/content/${sampleId}/playback`);
    assert.equal(r.status, 200);
    assert.ok(r.data.src);
  });

  it("search finds the Haldi ceremony", async () => {
    const r = await call("/content/search?q=haldi");
    assert.equal(r.status, 200);
    assert.ok(r.data.some((i: any) => /haldi/i.test(i.title)));
  });

  it("search with under 2 chars returns empty", async () => {
    const r = await call("/content/search?q=h");
    assert.deepEqual(r.data, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("media route", () => {
  it("serves a seeded asset", async () => {
    const home = await call("/wedding/home");
    const preview: string = home.data.hero.preview;
    assert.ok(preview, "hero should expose a preview URL");
    const assetId = preview.split("/media/")[1];
    const res = await app.request(`/api/v1/media/${assetId}`);
    // seeded assets have no R2 key → redirect to the sample URL
    assert.ok(
      res.status === 302 || res.status === 200,
      `expected 200/302, got ${res.status}`,
    );
  });

  it("unknown media id → 404", async () => {
    const res = await app.request(
      "/api/v1/media/00000000-0000-0000-0000-000000000000",
    );
    assert.equal(res.status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("admin authorization", () => {
  it("/admin/home without a token → 401", async () => {
    const r = await call("/admin/home");
    assert.equal(r.status, 401);
  });

  it("/admin/home with a token → 200", async () => {
    const r = await call("/admin/home", { token: adminToken });
    assert.equal(r.status, 200);
    assert.ok(Array.isArray(r.data.rows));
  });

  it("POST /admin/content without a token → 401", async () => {
    const r = await call("/admin/content", {
      method: "POST",
      body: { type: "film", title: "x" },
    });
    assert.equal(r.status, 401);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("admin content CRUD", () => {
  let createdId = "";

  it("creates content and a new row", async () => {
    const r = await call("/admin/content", {
      token: adminToken,
      method: "POST",
      body: {
        type: "film",
        title: "E2E Test Film",
        subtitle: "created by tests",
        collectionTitle: "E2E Test Row",
        status: "published",
      },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.title, "E2E Test Film");
    createdId = r.data.id;
  });

  it("new content appears on the admin home", async () => {
    const r = await call("/admin/home", { token: adminToken });
    const row = r.data.rows.find((x: any) => x.title === "E2E Test Row");
    assert.ok(row, "E2E Test Row should exist");
    assert.ok(row.items.some((i: any) => i.id === createdId));
  });

  it("patches the content title", async () => {
    const r = await call(`/admin/content/${createdId}`, {
      token: adminToken,
      method: "PATCH",
      body: { title: "E2E Renamed Film" },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.title, "E2E Renamed Film");
  });

  it("a plain edit does not reorder the row", async () => {
    const second = await call("/admin/content", {
      token: adminToken,
      method: "POST",
      body: {
        type: "film",
        title: "E2E Second Film",
        collectionTitle: "E2E Test Row",
        status: "published",
      },
    });
    // edit the first item, sending its (unchanged) row
    await call(`/admin/content/${createdId}`, {
      token: adminToken,
      method: "PATCH",
      body: { subtitle: "touched", collectionTitle: "E2E Test Row" },
    });
    const home = await call("/admin/home", { token: adminToken });
    const row = home.data.rows.find((x: any) => x.title === "E2E Test Row");
    assert.equal(
      row.items[0].id,
      createdId,
      "first item must stay first after an edit",
    );
    await call(`/admin/content/${second.data.id}`, {
      token: adminToken,
      method: "DELETE",
    });
  });

  it("deletes the content", async () => {
    const r = await call(`/admin/content/${createdId}`, {
      token: adminToken,
      method: "DELETE",
    });
    assert.equal(r.status, 200);
    const check = await call(`/content/${createdId}`);
    assert.equal(check.status, 404);
  });

  it("deleting unknown content → 404", async () => {
    const r = await call(
      "/admin/content/00000000-0000-0000-0000-000000000000",
      { token: adminToken, method: "DELETE" },
    );
    assert.equal(r.status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("admin wedding edit", () => {
  it("updates the tagline", async () => {
    const r = await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: { tagline: "E2E tagline" },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.tagline, "E2E tagline");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("media upload", () => {
  it("uploads a file and returns a ready asset", async () => {
    const fd = new FormData();
    fd.append(
      "file",
      new File([new Uint8Array([1, 2, 3, 4, 5])], "clip.mp4", {
        type: "video/mp4",
      }),
    );
    const r = await call("/admin/media/upload", {
      token: adminToken,
      method: "POST",
      formData: fd,
    });
    assert.equal(r.status, 200);
    assert.ok(r.data.assetId);
    assert.equal(r.data.kind, "video");
    assert.equal(r.data.status, "ready");
  });

  it("rejects an upload with no file", async () => {
    const fd = new FormData();
    const r = await call("/admin/media/upload", {
      token: adminToken,
      method: "POST",
      formData: fd,
    });
    assert.equal(r.status, 400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("invites", () => {
  it("creates an invite and a viewer can join with it", async () => {
    const inv = await call("/admin/invites", {
      token: adminToken,
      method: "POST",
      body: { role: "family" },
    });
    assert.equal(inv.status, 201);
    assert.ok(inv.data.token);

    const join = await call("/wedding/join", {
      method: "POST",
      body: { token: inv.data.token, name: "Test Guest" },
    });
    assert.equal(join.status, 200);
    assert.ok(join.data.accessToken);
    assert.equal(join.data.role, "family");
  });

  it("rejects an invalid invite token", async () => {
    const r = await call("/wedding/join", {
      method: "POST",
      body: { token: "invalid-token-1234" },
    });
    assert.equal(r.status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("validation", () => {
  it("rejects content with a missing title", async () => {
    const r = await call("/admin/content", {
      token: adminToken,
      method: "POST",
      body: { type: "film" },
    });
    assert.equal(r.status, 400);
  });

  it("rejects an invalid content type", async () => {
    const r = await call("/admin/content", {
      token: adminToken,
      method: "POST",
      body: { type: "banana", title: "Bad Type" },
    });
    assert.equal(r.status, 400);
  });

  it("rejects malformed JSON", async () => {
    const res = await app.request("/api/v1/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Wedding-Slug": SLUG,
      },
      body: "{not valid json",
    });
    assert.equal(res.status, 400);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
describe("profiles — who's watching", () => {
  it("lists the wedding's profiles", async () => {
    const r = await call("/wedding/profiles");
    assert.equal(r.status, 200);
    assert.ok(r.data.length >= 4, "demo wedding should have 4 profiles");
  });

  it("admin can create and delete a profile", async () => {
    const created = await call("/admin/profiles", {
      token: adminToken,
      method: "POST",
      body: { name: "E2E Profile" },
    });
    assert.equal(created.status, 201);
    const del = await call(`/admin/profiles/${created.data.id}`, {
      token: adminToken,
      method: "DELETE",
    });
    assert.equal(del.status, 200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("studio — multi-wedding", () => {
  it("rejects studio routes without auth", async () => {
    const r = await call("/studio/weddings");
    assert.equal(r.status, 401);
  });

  it("lists the studio's weddings", async () => {
    const r = await call("/studio/weddings", { token: adminToken });
    assert.equal(r.status, 200);
    assert.ok(
      r.data.some((w: { slug: string }) => w.slug === "bismita-debasish"),
    );
  });

  it("creates a new wedding that resolves as its own tenant", async () => {
    const slug = `e2e-wedding-${Date.now()}`;
    const r = await call("/studio/weddings", {
      token: adminToken,
      method: "POST",
      body: { coupleNameA: "Aarav", coupleNameB: "Ananya", slug },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.slug, slug);

    const home = await call("/wedding/home", { slug });
    assert.equal(home.status, 200);
    assert.equal(home.data.wedding.slug, slug);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("content visibility", () => {
  it("couple-only content is hidden from anonymous viewers", async () => {
    const created = await call("/admin/content", {
      token: adminToken,
      method: "POST",
      body: {
        type: "moment",
        title: "Private E2E Clip",
        visibility: "couple",
        status: "published",
      },
    });
    assert.equal(created.status, 201);

    const anon = await call(`/content/${created.data.id}`);
    assert.equal(anon.status, 403);

    await call(`/admin/content/${created.data.id}`, {
      token: adminToken,
      method: "DELETE",
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Permission boundary — an invited viewer must not slip into /admin/*.
describe("admin permission boundary", () => {
  let viewerToken = "";

  before(async () => {
    const inv = await call("/admin/invites", {
      token: adminToken,
      method: "POST",
      body: { role: "family" },
    });
    const join = await call("/wedding/join", {
      method: "POST",
      body: { token: inv.data.token, name: "Boundary Test" },
    });
    viewerToken = join.data.accessToken;
  });

  it("viewer token is rejected by /admin/home", async () => {
    const r = await call("/admin/home", { token: viewerToken });
    assert.equal(r.status, 403);
  });

  it("viewer token cannot create content", async () => {
    const r = await call("/admin/content", {
      token: viewerToken,
      method: "POST",
      body: { type: "film", title: "viewer attempt" },
    });
    assert.equal(r.status, 403);
  });

  it("viewer token cannot start a multipart upload", async () => {
    const r = await call("/admin/media/multipart/init", {
      token: viewerToken,
      method: "POST",
      body: { filename: "x.mp4", contentType: "video/mp4" },
    });
    assert.equal(r.status, 403);
  });

  it("viewer token cannot edit the wedding tagline", async () => {
    const r = await call("/admin/wedding", {
      token: viewerToken,
      method: "PATCH",
      body: { tagline: "hijack" },
    });
    assert.equal(r.status, 403);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Multipart upload routes — the chunked-upload path the admin UI uses for
// videos. Tests run with R2 unconfigured, so we exercise the local-dev
// fallback plus all the validation and tenant-scoping guards. The actual
// R2 happy path is verified by integration tests against the running service.
describe("multipart upload routes", () => {
  const FOREIGN_KEY =
    "weddings/00000000-0000-0000-0000-000000000099/foo.mp4";

  it("init requires auth", async () => {
    const r = await call("/admin/media/multipart/init", {
      method: "POST",
      body: { filename: "a.mp4" },
    });
    assert.equal(r.status, 401);
  });

  it("init with R2 off returns the legacy-fallback flag", async () => {
    const r = await call("/admin/media/multipart/init", {
      token: adminToken,
      method: "POST",
      body: {
        filename: "clip.mp4",
        contentType: "video/mp4",
        sizeBytes: 10,
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.direct, false);
  });

  it("init rejects a missing filename", async () => {
    const r = await call("/admin/media/multipart/init", {
      token: adminToken,
      method: "POST",
      body: { contentType: "video/mp4" },
    });
    assert.equal(r.status, 400);
  });

  it("part rejects a key from a different wedding", async () => {
    const url = `/api/v1/admin/media/multipart/part?key=${encodeURIComponent(
      FOREIGN_KEY,
    )}&uploadId=abc&partNumber=1`;
    const res = await app.request(url, {
      method: "PUT",
      headers: {
        "X-Wedding-Slug": SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      body: new Uint8Array([1, 2, 3]),
    });
    assert.equal(res.status, 400);
  });

  it("part rejects missing query params", async () => {
    const res = await app.request("/api/v1/admin/media/multipart/part", {
      method: "PUT",
      headers: {
        "X-Wedding-Slug": SLUG,
        Authorization: `Bearer ${adminToken}`,
      },
      body: new Uint8Array([1]),
    });
    assert.equal(res.status, 400);
  });

  it("complete rejects a key from a different wedding", async () => {
    const r = await call("/admin/media/multipart/complete", {
      token: adminToken,
      method: "POST",
      body: {
        key: FOREIGN_KEY,
        uploadId: "abc",
        parts: [{ partNumber: 1, etag: '"x"' }],
      },
    });
    assert.equal(r.status, 400);
  });

  it("complete rejects an empty parts array", async () => {
    const r = await call("/admin/media/multipart/complete", {
      token: adminToken,
      method: "POST",
      body: { key: FOREIGN_KEY, uploadId: "abc", parts: [] },
    });
    assert.equal(r.status, 400);
  });

  it("abort silently ignores a key from a different wedding", async () => {
    // A 200 with no R2 call — keeps a malicious client from probing other
    // weddings' uploads via an error-vs-success oracle.
    const r = await call("/admin/media/multipart/abort", {
      token: adminToken,
      method: "POST",
      body: { key: FOREIGN_KEY, uploadId: "abc" },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.aborted, true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Draft content must be admin-only — never leak to the public home/rows.
describe("draft vs published visibility", () => {
  let draftId = "";
  const ROW = "Drafts QA Row";

  it("admin can create a draft", async () => {
    const r = await call("/admin/content", {
      token: adminToken,
      method: "POST",
      body: {
        type: "film",
        title: "E2E Draft Clip",
        collectionTitle: ROW,
        status: "draft",
      },
    });
    assert.equal(r.status, 201);
    draftId = r.data.id;
  });

  it("draft does NOT appear in the public home", async () => {
    const r = await call("/wedding/home");
    const row = r.data.rows.find((x: any) => x.title === ROW);
    if (row) {
      assert.ok(
        !row.items.some((i: any) => i.id === draftId),
        "draft must not be listed in the public row",
      );
    }
  });

  it("draft DOES appear in the admin home", async () => {
    const r = await call("/admin/home", { token: adminToken });
    const row = r.data.rows.find((x: any) => x.title === ROW);
    assert.ok(row, "admin home should include the drafts row");
    assert.ok(
      row.items.some((i: any) => i.id === draftId),
      "admin must see the draft",
    );
  });

  after(async () => {
    if (draftId) {
      await call(`/admin/content/${draftId}`, {
        token: adminToken,
        method: "DELETE",
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// setAsHero promotes a content item to the wedding's homepage hero.
describe("setAsHero flow", () => {
  let candidateId = "";
  let originalHeroId: string | null = null;

  before(async () => {
    const home = await call("/wedding/home");
    originalHeroId = home.data.hero?.id ?? null;
  });

  it("creating with setAsHero=true promotes the new item to hero", async () => {
    const r = await call("/admin/content", {
      token: adminToken,
      method: "POST",
      body: {
        type: "film",
        title: "E2E Hero Candidate",
        status: "published",
        setAsHero: true,
      },
    });
    assert.equal(r.status, 201);
    candidateId = r.data.id;
    const home = await call("/wedding/home");
    assert.equal(home.data.hero?.id, candidateId);
  });

  it("PATCH with setAsHero=true on a different item swaps the hero back", async () => {
    if (!originalHeroId) return; // seed had no hero — skip
    const r = await call(`/admin/content/${originalHeroId}`, {
      token: adminToken,
      method: "PATCH",
      body: { setAsHero: true },
    });
    assert.equal(r.status, 200);
    const home = await call("/wedding/home");
    assert.equal(home.data.hero?.id, originalHeroId);
  });

  after(async () => {
    if (candidateId) {
      await call(`/admin/content/${candidateId}`, {
        token: adminToken,
        method: "DELETE",
      });
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("profile rename (PATCH)", () => {
  it("admin can rename a profile", async () => {
    const created = await call("/admin/profiles", {
      token: adminToken,
      method: "POST",
      body: { name: "Rename Me" },
    });
    assert.equal(created.status, 201);
    const renamed = await call(`/admin/profiles/${created.data.id}`, {
      token: adminToken,
      method: "PATCH",
      body: { name: "Renamed" },
    });
    assert.equal(renamed.status, 200);
    assert.equal(renamed.data.name, "Renamed");
    await call(`/admin/profiles/${created.data.id}`, {
      token: adminToken,
      method: "DELETE",
    });
  });

  it("PATCH on an unknown profile id → 404", async () => {
    const r = await call(
      "/admin/profiles/00000000-0000-0000-0000-000000000000",
      { token: adminToken, method: "PATCH", body: { name: "Ghost" } },
    );
    assert.equal(r.status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Per-wedding theme customisation — the admin can set brandName, colours,
// fonts and sizing knobs. PATCHes must merge with existing theme JSON, never
// drop fields the client didn't send.
describe("wedding theme", () => {
  it("admin can set theme fields", async () => {
    const r = await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: {
        theme: {
          brandName: "QPIX FILMS",
          primary: "#7c3aed",
          headingFont: "Cormorant Garamond",
          headingScale: "large",
          thumbnailSize: "small",
          heroHeight: "medium",
        },
      },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.theme.brandName, "QPIX FILMS");
    assert.equal(r.data.theme.primary, "#7c3aed");
    assert.equal(r.data.theme.headingFont, "Cormorant Garamond");
    assert.equal(r.data.theme.headingScale, "large");
    assert.equal(r.data.theme.thumbnailSize, "small");
    assert.equal(r.data.theme.heroHeight, "medium");
  });

  it("a partial PATCH merges instead of replacing", async () => {
    // first PATCH sets primary; second PATCH sets accent only — primary must
    // survive on the server.
    await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: { theme: { primary: "#aa0000" } },
    });
    const second = await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: { theme: { accent: "#00aa00" } },
    });
    assert.equal(second.status, 200);
    assert.equal(second.data.theme.primary, "#aa0000");
    assert.equal(second.data.theme.accent, "#00aa00");
  });

  it("rejects a non-hex primary colour", async () => {
    const r = await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: { theme: { primary: "rebeccapurple" } },
    });
    assert.equal(r.status, 400);
  });

  it("rejects an unknown heading font", async () => {
    const r = await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: { theme: { headingFont: "Comic Sans MS" } },
    });
    assert.equal(r.status, 400);
  });

  it("theme is exposed on the public /wedding payload", async () => {
    // The setup test above persists fields; here we just confirm the
    // anonymous /wedding endpoint returns them.
    const r = await call("/wedding");
    assert.equal(r.status, 200);
    assert.ok(r.data.theme, "wedding payload must include a theme object");
    assert.ok(
      typeof r.data.theme.brandName === "string" ||
        r.data.theme.brandName === undefined,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Seasons — admins group episodes into seasons; deleting a season un-assigns
// its episodes (via FK ON DELETE SET NULL) instead of cascading.
describe("seasons admin CRUD", () => {
  let seasonId = "";

  it("admin can create a season", async () => {
    const r = await call("/admin/seasons", {
      token: adminToken,
      method: "POST",
      body: { number: 99, title: "QA Season", description: "for tests" },
    });
    assert.equal(r.status, 201);
    assert.equal(r.data.title, "QA Season");
    seasonId = r.data.id;
  });

  it("admin can rename a season via PATCH", async () => {
    const r = await call(`/admin/seasons/${seasonId}`, {
      token: adminToken,
      method: "PATCH",
      body: { title: "QA Season Renamed" },
    });
    assert.equal(r.status, 200);
    assert.equal(r.data.title, "QA Season Renamed");
  });

  it("PATCH on an unknown season id → 404", async () => {
    const r = await call(
      "/admin/seasons/00000000-0000-0000-0000-000000000000",
      { token: adminToken, method: "PATCH", body: { title: "ghost" } },
    );
    assert.equal(r.status, 404);
  });

  it("assigning then unassigning an episode preserves the content row", async () => {
    // Create a content item, assign it to the season, then unassign with null.
    const created = await call("/admin/content", {
      token: adminToken,
      method: "POST",
      body: { type: "episode", title: "Season Test Clip", status: "published" },
    });
    const id = created.data.id;
    const assign = await call(`/admin/content/${id}`, {
      token: adminToken,
      method: "PATCH",
      body: { seasonId },
    });
    assert.equal(assign.status, 200);
    assert.equal(assign.data.seasonId, seasonId);

    const unassign = await call(`/admin/content/${id}`, {
      token: adminToken,
      method: "PATCH",
      body: { seasonId: null },
    });
    assert.equal(unassign.status, 200);
    assert.equal(unassign.data.seasonId, null);

    await call(`/admin/content/${id}`, {
      token: adminToken,
      method: "DELETE",
    });
  });

  it("deleting a season un-assigns episodes instead of dropping them", async () => {
    // Make an episode bound to the season, delete the season, episode must
    // survive with seasonId=null.
    const ep = await call("/admin/content", {
      token: adminToken,
      method: "POST",
      body: {
        type: "episode",
        title: "Episode Survives",
        seasonId,
        status: "published",
      },
    });
    const epId = ep.data.id;

    const del = await call(`/admin/seasons/${seasonId}`, {
      token: adminToken,
      method: "DELETE",
    });
    assert.equal(del.status, 200);

    // Episode still exists in the public detail endpoint.
    const after = await call(`/content/${epId}`);
    assert.equal(after.status, 200);
    assert.equal(after.data.seasonId, null);

    await call(`/admin/content/${epId}`, {
      token: adminToken,
      method: "DELETE",
    });
  });

  it("DELETE on an unknown season id → 404", async () => {
    const r = await call(
      "/admin/seasons/00000000-0000-0000-0000-000000000000",
      { token: adminToken, method: "DELETE" },
    );
    assert.equal(r.status, 404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('"Starring" field on the wedding', () => {
  it("PATCH /admin/wedding sets and clears the starring line", async () => {
    const set = await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: { starring: "Bride · Groom · Families · Friends" },
    });
    assert.equal(set.status, 200);
    assert.equal(set.data.starring, "Bride · Groom · Families · Friends");

    const clear = await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: { starring: null },
    });
    assert.equal(clear.status, 200);
    assert.equal(clear.data.starring, null);
  });

  it("the public /wedding payload exposes starring", async () => {
    await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: { starring: "Test Cast" },
    });
    const pub = await call("/wedding");
    assert.equal(pub.status, 200);
    assert.equal(pub.data.starring, "Test Cast");
    // Reset.
    await call("/admin/wedding", {
      token: adminToken,
      method: "PATCH",
      body: { starring: null },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe("studio creation validation", () => {
  it("rejects a duplicate slug with 409", async () => {
    const r = await call("/studio/weddings", {
      token: adminToken,
      method: "POST",
      body: { coupleNameA: "Dup", coupleNameB: "Slug", slug: SLUG },
    });
    assert.equal(r.status, 409);
  });

  it("rejects a slug that breaks the URL-safe pattern", async () => {
    const r = await call("/studio/weddings", {
      token: adminToken,
      method: "POST",
      body: {
        coupleNameA: "A",
        coupleNameB: "B",
        slug: "INVALID Slug!",
      },
    });
    assert.equal(r.status, 400);
  });
});
