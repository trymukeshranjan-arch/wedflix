import { useState, useEffect, useCallback } from "react";
import { X, Trash2, Plus, Pencil, Check } from "lucide-react";
import { api, ApiError } from "../api/client";

interface Season {
  id: string;
  number: number;
  title: string;
  description: string | null;
}

// Manage a wedding's seasons. Episodes get assigned to seasons from the
// content edit modal; deleting a season here just un-assigns its episodes
// (they return to the regular homepage rows).
export function SeasonsModal({ onClose }: { onClose: () => void }) {
  const [seasons, setSeasons] = useState<Season[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Inline create state
  const [newNumber, setNewNumber] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [busy, setBusy] = useState(false);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNumber, setEditNumber] = useState("");

  const load = useCallback(() => {
    api<Season[]>("/admin/seasons")
      .then(setSeasons)
      .catch(() => setSeasons([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    const num = parseInt(newNumber, 10);
    if (!num || num < 1 || !newTitle.trim()) {
      setError("Season number and title are required");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api("/admin/seasons", {
        method: "POST",
        body: { number: num, title: newTitle.trim() },
      });
      setNewNumber("");
      setNewTitle("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not create season");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (s: Season) => {
    setEditingId(s.id);
    setEditTitle(s.title);
    setEditNumber(String(s.number));
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const num = parseInt(editNumber, 10);
    if (!num || !editTitle.trim()) return;
    try {
      await api(`/admin/seasons/${editingId}`, {
        method: "PATCH",
        body: { number: num, title: editTitle.trim() },
      });
      setEditingId(null);
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    }
  };

  const remove = async (s: Season) => {
    if (
      !window.confirm(
        `Delete "${s.title}"? Episodes in it will return to the home rows.`,
      )
    ) {
      return;
    }
    try {
      await api(`/admin/seasons/${s.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete");
    }
  };

  const rowCls =
    "flex items-center gap-2 bg-background border border-border rounded px-3 py-2";

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Seasons</h3>
            <p className="text-xs text-muted-foreground">
              Group videos into seasons that appear on the Seasons page.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {seasons === null && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {seasons?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No seasons yet. Add the first one below.
            </p>
          )}
          {seasons?.map((s) =>
            editingId === s.id ? (
              <div key={s.id} className={rowCls}>
                <input
                  type="number"
                  min={1}
                  value={editNumber}
                  onChange={(e) => setEditNumber(e.target.value)}
                  className="w-16 bg-card border border-border rounded px-2 py-1 text-sm"
                />
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="flex-1 bg-card border border-border rounded px-2 py-1 text-sm"
                />
                <button
                  onClick={saveEdit}
                  className="text-accent hover:text-foreground p-1.5"
                  title="Save"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-muted-foreground hover:text-foreground p-1.5"
                  title="Cancel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div key={s.id} className={rowCls}>
                <span className="text-xs text-muted-foreground w-16">
                  Season {s.number}
                </span>
                <span className="flex-1 text-sm">{s.title}</span>
                <button
                  onClick={() => startEdit(s)}
                  className="text-muted-foreground hover:text-foreground p-1.5"
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => remove(s)}
                  className="text-muted-foreground hover:text-primary p-1.5"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ),
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-border mt-3">
            <input
              type="number"
              min={1}
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="#"
              className="w-16 bg-background border border-border rounded px-2 py-2 text-sm"
            />
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="Season title (e.g. The Wedding Days)"
              className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm"
            />
            <button
              onClick={add}
              disabled={busy}
              className="flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-white text-sm rounded px-3 py-2 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>

          {error && (
            <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded px-3 py-2 mt-3">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="bg-foreground/10 hover:bg-foreground/15 text-sm rounded px-5 py-2"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
