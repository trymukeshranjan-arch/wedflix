import { useState, useEffect, useCallback } from "react";
import { X, Trash2, Plus } from "lucide-react";
import { api, ApiError } from "../api/client";

interface Profile {
  id: string;
  name: string;
  avatarUrl: string | null;
  sortOrder: number;
}

// Manage a wedding's "Who's watching" profiles.
export function ProfilesModal({ onClose }: { onClose: () => void }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Profile[]>("/admin/profiles")
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await api("/admin/profiles", {
        method: "POST",
        body: { name: newName.trim(), sortOrder: profiles?.length ?? 0 },
      });
      setNewName("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not add profile");
    } finally {
      setBusy(false);
    }
  };

  const rename = async (id: string, name: string) => {
    if (!name.trim()) return;
    try {
      await api(`/admin/profiles/${id}`, {
        method: "PATCH",
        body: { name: name.trim() },
      });
    } catch {
      load();
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm("Delete this profile?")) return;
    try {
      await api(`/admin/profiles/${id}`, { method: "DELETE" });
      load();
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Who&apos;s Watching — Profiles</h3>
            <p className="text-xs text-muted-foreground">
              These appear on the profile picker.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-2">
          {profiles === null && (
            <p className="text-sm text-muted-foreground">Loading…</p>
          )}
          {profiles?.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <input
                defaultValue={p.name}
                onBlur={(e) => rename(p.id, e.target.value)}
                className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                onClick={() => remove(p.id)}
                className="text-muted-foreground hover:text-primary p-2"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && add()}
              placeholder="New profile name…"
              className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent"
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
            <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded px-3 py-2">
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
