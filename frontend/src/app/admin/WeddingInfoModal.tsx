import { useState } from "react";
import { X } from "lucide-react";
import { api, ApiError } from "../api/client";
import type { WeddingInfo } from "../api/types";

export function WeddingInfoModal({
  wedding,
  onClose,
  onSaved,
}: {
  wedding: WeddingInfo;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [coupleNameA, setA] = useState(wedding.coupleNameA);
  const [coupleNameB, setB] = useState(wedding.coupleNameB);
  const [tagline, setTagline] = useState(wedding.tagline ?? "");
  const [starring, setStarring] = useState(wedding.starring ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api("/admin/wedding", {
        method: "PATCH",
        body: {
          coupleNameA: coupleNameA.trim(),
          coupleNameB: coupleNameB.trim(),
          tagline: tagline.trim() || undefined,
          // null explicitly clears the starring field on the server.
          starring: starring.trim() ? starring.trim() : null,
        },
      });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "mt-1 w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-accent transition-colors text-sm";
  const labelCls = "text-xs text-muted-foreground uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-center justify-center px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">Edit Couple & Tagline</h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Partner A</label>
              <input
                className={field}
                value={coupleNameA}
                onChange={(e) => setA(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls}>Partner B</label>
              <input
                className={field}
                value={coupleNameB}
                onChange={(e) => setB(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Tagline</label>
            <input
              className={field}
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="A Cinematic Wedding Journey · 2024"
            />
          </div>
          <div>
            <label className={labelCls}>Starring</label>
            <input
              className={field}
              value={starring}
              onChange={(e) => setStarring(e.target.value)}
              placeholder="Bride · Groom · Families · Friends"
              maxLength={300}
            />
            <p className="text-xs text-muted-foreground/70 mt-1">
              Cast line shown on the Seasons page. Leave blank to hide.
            </p>
          </div>
          {error && (
            <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={submitting}
            className="bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded px-5 py-2 transition-all disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
