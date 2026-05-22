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
