import { useEffect, useState } from "react";
import {
  X,
  UploadCloud,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Trash2,
} from "lucide-react";
import { api, ApiError, mediaUrl } from "../api/client";
import type { ContentItem } from "../api/types";

const TYPES = ["film", "episode", "teaser", "reel", "moment", "drone"];
type UploadState = "idle" | "uploading" | "done" | "error";

export interface EditTarget {
  mode: "create" | "edit";
  item?: ContentItem;
  row?: string;
  isHero?: boolean;
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      const d = isFinite(v.duration) ? Math.round(v.duration) : null;
      URL.revokeObjectURL(v.src);
      resolve(d);
    };
    v.onerror = () => resolve(null);
    v.src = URL.createObjectURL(file);
  });
}

// 20 MiB — comfortably under Cloud Run's 32 MiB request cap.
const CHUNK_SIZE = 20 * 1024 * 1024;

async function uploadFile(
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<{ assetId: string; url: string }> {
  const init = await api<{
    direct: boolean;
    assetId?: string;
    url?: string;
    key?: string;
    uploadId?: string;
  }>("/admin/media/multipart/init", {
    method: "POST",
    body: {
      filename: file.name,
      contentType: file.type,
      sizeBytes: file.size,
    },
  });

  // Local dev with no R2 — send the whole file in one request.
  if (!init.direct) {
    const fd = new FormData();
    fd.append("file", file);
    const r = await api<{ assetId: string; url: string }>(
      "/admin/media/upload",
      { formData: fd },
    );
    onProgress?.(1);
    return r;
  }

  const { assetId, url, key, uploadId } = init;
  const totalParts = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  const parts: { partNumber: number; etag: string }[] = [];

  try {
    for (let i = 0; i < totalParts; i++) {
      const chunk = file.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
      const partNumber = i + 1;
      const r = await api<{ partNumber: number; etag: string }>(
        `/admin/media/multipart/part?key=${encodeURIComponent(
          key!,
        )}&uploadId=${encodeURIComponent(uploadId!)}&partNumber=${partNumber}`,
        { method: "PUT", raw: chunk },
      );
      parts.push(r);
      onProgress?.((i + 1) / totalParts);
    }
    await api("/admin/media/multipart/complete", {
      method: "POST",
      body: { key, uploadId, parts },
    });
  } catch (e) {
    api("/admin/media/multipart/abort", {
      method: "POST",
      body: { key, uploadId },
    }).catch(() => {});
    throw e;
  }

  return { assetId: assetId!, url: url! };
}

export function ContentEditModal({
  target,
  onClose,
  onSaved,
}: {
  target: EditTarget;
  onClose: () => void;
  onSaved: () => void;
}) {
  const item = target.item;
  const isEdit = target.mode === "edit";

  const [title, setTitle] = useState(item?.title ?? "");
  const [subtitle, setSubtitle] = useState(item?.subtitle ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [type, setType] = useState(item?.type ?? "film");
  const [section, setSection] = useState(target.row ?? "");
  const [status, setStatus] = useState(item?.status ?? "published");
  const [setAsHero, setSetAsHero] = useState(Boolean(target.isHero));
  const [tags, setTags] = useState((item?.tags ?? []).join(", "));
  const [durationSeconds, setDurationSeconds] = useState<number | null>(
    item?.durationSeconds ?? null,
  );
  // "" means "no season". seasonId state holds the season UUID or "".
  const [seasonId, setSeasonId] = useState<string>(item?.seasonId ?? "");
  const [seasonList, setSeasonList] = useState<
    { id: string; number: number; title: string }[]
  >([]);
  // Per-profile visibility. Empty array = visible to everyone; populated =
  // only these profiles see the item. Fetched live from /admin/profiles.
  const [visibleProfileIds, setVisibleProfileIds] = useState<string[]>(
    item?.visibleProfileIds ?? [],
  );
  const [profileList, setProfileList] = useState<
    { id: string; name: string; hasPin?: boolean }[]
  >([]);

  useEffect(() => {
    api<{ id: string; number: number; title: string }[]>("/admin/seasons")
      .then(setSeasonList)
      .catch(() => setSeasonList([]));
    api<{ id: string; name: string; hasPin?: boolean }[]>("/admin/profiles")
      .then(setProfileList)
      .catch(() => setProfileList([]));
  }, []);

  const [videoStatus, setVideoStatus] = useState<UploadState>(
    isEdit ? "done" : "idle",
  );
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoAssetId, setVideoAssetId] = useState<string | null>(null);
  const [thumbStatus, setThumbStatus] = useState<UploadState>(
    item?.thumbnail ? "done" : "idle",
  );
  const [thumbUrl, setThumbUrl] = useState<string | null>(
    item?.thumbnail ?? null,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onVideo = async (file: File) => {
    setVideoStatus("uploading");
    setVideoProgress(0);
    const dur = await readDuration(file);
    if (dur) setDurationSeconds(dur);
    try {
      const r = await uploadFile(file, setVideoProgress);
      setVideoAssetId(r.assetId);
      setVideoStatus("done");
    } catch {
      setVideoStatus("error");
    }
  };

  const onThumb = async (file: File) => {
    setThumbStatus("uploading");
    try {
      const r = await uploadFile(file);
      setThumbUrl(r.url);
      setThumbStatus("done");
    } catch {
      setThumbStatus("error");
    }
  };

  const save = async () => {
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (target.mode === "create" && !videoAssetId) {
      setError("Please upload a video first");
      return;
    }
    setSubmitting(true);
    setError(null);
    const payload: Record<string, unknown> = {
      type,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      description: description.trim() || undefined,
      // Per-profile visibility — empty = everyone, populated = restricted.
      visibleProfileIds,
      status,
      collectionTitle: section.trim() || undefined,
      setAsHero: setAsHero || undefined,
      // Empty string in the select = "no season" → send null to clear.
      seasonId: seasonId || null,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      durationSeconds: durationSeconds ?? undefined,
      thumbnailUrl: thumbUrl || undefined,
    };
    if (videoAssetId) payload.primaryAssetId = videoAssetId;

    try {
      if (target.mode === "create") {
        await api("/admin/content", { method: "POST", body: payload });
      } else {
        await api(`/admin/content/${item!.id}`, {
          method: "PATCH",
          body: payload,
        });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save");
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async () => {
    if (!item) return;
    if (!window.confirm(`Delete “${item.title}” permanently?`)) return;
    setSubmitting(true);
    setError(null);
    try {
      await api(`/admin/content/${item.id}`, { method: "DELETE" });
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not delete");
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    "mt-1 w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-accent transition-colors text-sm";
  const labelCls = "text-xs text-muted-foreground uppercase tracking-wider";

  return (
    <div className="fixed inset-0 z-[300] bg-black/80 flex items-start justify-center overflow-y-auto py-10 px-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold">
            {isEdit ? "Edit Content" : "Add Content"}
          </h3>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Video */}
          <label className="block cursor-pointer">
            <span className={labelCls}>
              Video {isEdit ? "(replace — optional)" : "*"}
            </span>
            <div className="mt-1 border border-dashed border-border rounded-lg p-3 bg-background hover:border-accent/50 transition-colors flex items-center gap-3">
              {videoStatus === "uploading" ? (
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              ) : videoStatus === "done" ? (
                <CheckCircle2 className="w-5 h-5 text-accent" />
              ) : videoStatus === "error" ? (
                <AlertCircle className="w-5 h-5 text-primary" />
              ) : (
                <UploadCloud className="w-5 h-5 text-muted-foreground" />
              )}
              <span className="text-sm text-muted-foreground">
                {videoStatus === "uploading"
                  ? `Uploading… ${Math.round(videoProgress * 100)}%`
                  : videoStatus === "error"
                    ? "Upload failed — click to try again"
                    : videoAssetId
                      ? "New video uploaded"
                      : isEdit
                        ? "Current video kept — click to replace"
                        : "Click to choose a video"}
              </span>
            </div>
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onVideo(f);
              }}
            />
          </label>

          {/* Thumbnail */}
          <div>
            <span className={labelCls}>Thumbnail</span>
            <div className="mt-1 flex items-center gap-3">
              <div className="w-24 h-14 rounded bg-background border border-border overflow-hidden flex-shrink-0">
                {thumbUrl && (
                  <img
                    src={mediaUrl(thumbUrl)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <label className="cursor-pointer text-sm text-accent hover:underline flex items-center gap-1.5">
                {thumbStatus === "uploading" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImageIcon className="w-4 h-4" />
                )}
                {thumbUrl ? "Change image" : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onThumb(f);
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className={labelCls}>Title *</label>
            <input
              className={field}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Subtitle</label>
            <input
              className={field}
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <textarea
              className={field}
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select
                className={field}
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                {TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Row / Section</label>
              <input
                className={field}
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Our Films"
              />
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                className={field}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Visible to</label>
            <div className="mt-1 border border-border rounded p-3 space-y-2 bg-background">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={visibleProfileIds.length === 0}
                  onChange={() => setVisibleProfileIds([])}
                />
                <span className="font-medium">Everyone</span>
                <span className="text-xs text-muted-foreground">
                  (no restriction)
                </span>
              </label>
              {profileList.length > 0 && (
                <div className="border-t border-border pt-2 space-y-1.5">
                  {profileList.map((p) => {
                    const checked = visibleProfileIds.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            // Checking a profile removes the implicit "everyone"
                            // and adds this profile; unchecking removes it (and
                            // an empty list reverts to "everyone").
                            setVisibleProfileIds((cur) =>
                              checked
                                ? cur.filter((id) => id !== p.id)
                                : [...cur, p.id],
                            );
                          }}
                        />
                        <span>{p.name}</span>
                        {p.hasPin && (
                          <span className="text-xs text-accent">🔒</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
              {profileList.length === 0 && (
                <p className="text-xs text-muted-foreground/70 border-t border-border pt-2">
                  No profiles yet. Add them from the Profiles button in the
                  admin nav to restrict visibility.
                </p>
              )}
            </div>
          </div>

          <div>
            <label className={labelCls}>Season</label>
            <select
              className={field}
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
            >
              <option value="">(no season)</option>
              {seasonList.map((s) => (
                <option key={s.id} value={s.id}>
                  Season {s.number} — {s.title}
                </option>
              ))}
            </select>
            {seasonList.length === 0 && (
              <p className="text-xs text-muted-foreground/70 mt-1">
                No seasons yet. Create one from the Seasons button in the
                admin nav.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>Tags (comma separated)</label>
            <input
              className={field}
              value={tags}
              onChange={(e) => setTags(e.target.value)}
            />
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={setAsHero}
              onChange={(e) => setSetAsHero(e.target.checked)}
            />
            Set as homepage hero
          </label>

          {error && (
            <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded px-3 py-2">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-border">
          {isEdit ? (
            <button
              onClick={remove}
              disabled={submitting}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="text-sm text-muted-foreground hover:text-foreground px-4 py-2"
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={submitting || videoStatus === "uploading"}
              className="bg-primary hover:bg-primary/90 text-white text-sm font-semibold rounded px-5 py-2 transition-all disabled:opacity-50"
            >
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Publish"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
