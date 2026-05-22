import { useState, useEffect, useCallback } from "react";
import { Plus, LogOut, ExternalLink, Film } from "lucide-react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../lib/auth";

interface Wedding {
  id: string;
  slug: string;
  coupleNameA: string;
  coupleNameB: string;
  status: string;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// Studio admin landing: pick a wedding to manage, or create a new one.
export function AdminWeddingList({
  onPick,
}: {
  onPick: (slug: string) => void;
}) {
  const { logout } = useAuth();
  const [weddings, setWeddings] = useState<Wedding[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManual, setSlugManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Wedding[]>("/studio/weddings")
      .then(setWeddings)
      .catch(() => setWeddings([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onName = (which: "a" | "b", value: string) => {
    const a = which === "a" ? value : nameA;
    const b = which === "b" ? value : nameB;
    if (which === "a") setNameA(value);
    else setNameB(value);
    if (!slugManual) setSlug(slugify(`${a} ${b}`));
  };

  const create = async () => {
    if (!nameA.trim() || !nameB.trim() || !slug.trim()) {
      setError("Fill in both names and a URL slug");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const w = await api<{ slug: string }>("/studio/weddings", {
        method: "POST",
        body: {
          coupleNameA: nameA.trim(),
          coupleNameB: nameB.trim(),
          slug: slug.trim(),
        },
      });
      onPick(w.slug);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create wedding");
    } finally {
      setBusy(false);
    }
  };

  const field =
    "mt-1 w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-accent transition-colors text-sm";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="px-6 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <h1
            className="text-xl font-bold text-primary tracking-[0.15em]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            WEDFLIX
          </h1>
          <span className="text-[10px] font-bold bg-accent/15 text-accent px-2 py-0.5 rounded-full tracking-wider">
            STUDIO
          </span>
        </div>
        <button
          onClick={logout}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </nav>

      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">Your Weddings</h2>
            <p className="text-sm text-muted-foreground">
              Pick a wedding to manage, or add a new one.
            </p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded px-4 py-2"
          >
            <Plus className="w-4 h-4" />
            New Wedding
          </button>
        </div>

        {showForm && (
          <div className="bg-card border border-border rounded-xl p-5 mb-6 space-y-3">
            <h3 className="font-semibold">Create a new wedding</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Partner A
                </label>
                <input
                  className={field}
                  value={nameA}
                  onChange={(e) => onName("a", e.target.value)}
                  placeholder="Aarav"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider">
                  Partner B
                </label>
                <input
                  className={field}
                  value={nameB}
                  onChange={(e) => onName("b", e.target.value)}
                  placeholder="Ananya"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider">
                URL slug
              </label>
              <input
                className={field}
                value={slug}
                onChange={(e) => {
                  setSlug(slugify(e.target.value));
                  setSlugManual(true);
                }}
                placeholder="aarav-ananya"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Wedding link: <code>/w/{slug || "your-slug"}</code>
              </p>
            </div>
            {error && (
              <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowForm(false)}
                className="text-sm text-muted-foreground hover:text-foreground px-4 py-2"
              >
                Cancel
              </button>
              <button
                onClick={create}
                disabled={busy}
                className="bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded px-5 py-2 disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create & Manage"}
              </button>
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          {weddings === null && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {weddings?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No weddings yet — create your first one above.
            </p>
          )}
          {weddings?.map((w) => (
            <div
              key={w.id}
              className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="font-semibold truncate">
                  {w.coupleNameA} ∞ {w.coupleNameB}
                </div>
                <div className="text-xs text-muted-foreground">/w/{w.slug}</div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`/w/${w.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-muted-foreground hover:text-foreground p-2"
                  title="View site"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
                <button
                  onClick={() => onPick(w.slug)}
                  className="flex items-center gap-1.5 bg-foreground/10 hover:bg-foreground/15 text-sm rounded px-3 py-1.5"
                >
                  <Film className="w-4 h-4" />
                  Manage
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
