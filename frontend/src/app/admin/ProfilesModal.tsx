import { useState, useEffect, useCallback } from "react";
import { X, Trash2, Plus, Lock, Unlock } from "lucide-react";
import { api, ApiError } from "../api/client";

interface Profile {
  id: string;
  name: string;
  avatarUrl: string | null;
  sortOrder: number;
  hasPin?: boolean;
}

// Manage a wedding's "Who's watching" profiles, including an optional
// 4-digit PIN lock per profile.
export function ProfilesModal({ onClose }: { onClose: () => void }) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Which profile's PIN editor is open, and its current value.
  const [pinEditId, setPinEditId] = useState<string | null>(null);
  const [pinValue, setPinValue] = useState("");

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

  const openPinEditor = (id: string) => {
    setPinEditId(id);
    setPinValue("");
    setError(null);
  };

  const savePin = async (id: string) => {
    if (!/^\d{4}$/.test(pinValue)) {
      setError("PIN must be exactly 4 digits");
      return;
    }
    try {
      await api(`/admin/profiles/${id}`, {
        method: "PATCH",
        body: { pin: pinValue },
      });
      setPinEditId(null);
      setPinValue("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not set PIN");
    }
  };

  const removePin = async (id: string) => {
    try {
      await api(`/admin/profiles/${id}`, {
        method: "PATCH",
        body: { pin: null },
      });
      setPinEditId(null);
      setPinValue("");
      load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not remove PIN");
    }
  };

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold">Who&apos;s Watching — Profiles</h3>
            <p className="text-xs text-muted-foreground">
              These appear on the profile picker. Add a PIN to lock a profile.
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
            <div key={p.id} className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  defaultValue={p.name}
                  onBlur={(e) => rename(p.id, e.target.value)}
                  className="flex-1 bg-background border border-border rounded px-3 py-2 text-sm outline-none focus:border-accent"
                />
                <button
                  onClick={() =>
                    pinEditId === p.id ? setPinEditId(null) : openPinEditor(p.id)
                  }
                  className={`p-2 transition-colors ${
                    p.hasPin
                      ? "text-accent hover:text-accent/80"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={p.hasPin ? "Locked — change PIN" : "Add a PIN lock"}
                >
                  {p.hasPin ? (
                    <Lock className="w-4 h-4" />
                  ) : (
                    <Unlock className="w-4 h-4" />
                  )}
                </button>
                <button
                  onClick={() => remove(p.id)}
                  className="text-muted-foreground hover:text-primary p-2"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {pinEditId === p.id && (
                <div className="flex items-center gap-2 pl-1 pb-1">
                  <input
                    value={pinValue}
                    onChange={(e) =>
                      setPinValue(e.target.value.replace(/\D/g, "").slice(0, 4))
                    }
                    inputMode="numeric"
                    maxLength={4}
                    autoFocus
                    placeholder={p.hasPin ? "New 4-digit PIN" : "4-digit PIN"}
                    className="w-32 bg-background border border-border rounded px-3 py-1.5 text-sm tracking-[0.4em] outline-none focus:border-accent"
                  />
                  <button
                    onClick={() => savePin(p.id)}
                    className="bg-primary hover:bg-primary/90 text-white text-xs rounded px-3 py-1.5"
                  >
                    Save
                  </button>
                  {p.hasPin && (
                    <button
                      onClick={() => removePin(p.id)}
                      className="text-xs text-muted-foreground hover:text-primary px-2 py-1.5"
                    >
                      Remove
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setPinEditId(null);
                      setError(null);
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2 border-t border-border mt-3">
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
