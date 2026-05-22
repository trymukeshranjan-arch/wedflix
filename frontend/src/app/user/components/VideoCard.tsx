import { useRef, useState, useEffect } from "react";
import { Play, Pencil, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import type { ContentItem } from "../../api/types";

// A content card whose thumbnail plays a muted, looping video preview while
// it is visible in the viewport. In admin mode it also shows Edit/Delete
// controls so the admin can manage content right on the live layout.
export function VideoCard({
  item,
  onPlay,
  admin,
  onEdit,
  onDelete,
}: {
  item: ContentItem;
  onPlay: (item: ContentItem) => void;
  admin?: boolean;
  onEdit?: (item: ContentItem) => void;
  onDelete?: (item: ContentItem) => void;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(false);
  const [previewReady, setPreviewReady] = useState(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !item.preview) return;
    if (inView) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  }, [inView, item.preview]);

  return (
    <motion.div
      ref={wrapRef}
      className="group relative w-full cursor-pointer"
      whileHover={{ scale: 1.06, zIndex: 20 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      onClick={() => onPlay(item)}
    >
      <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
        {item.thumbnail && (
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              previewReady ? "opacity-0" : "opacity-100"
            }`}
          />
        )}
        {item.preview && (
          <video
            ref={videoRef}
            src={item.preview}
            muted
            loop
            playsInline
            preload="none"
            onPlaying={() => setPreviewReady(true)}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              previewReady ? "opacity-100" : "opacity-0"
            }`}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Admin edit / delete controls */}
        {admin && (
          <div className="absolute top-2 left-2 flex gap-1.5 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(item);
              }}
              className="bg-black/75 hover:bg-accent text-white rounded-full p-1.5 transition-colors"
              title="Edit"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(item);
              }}
              className="bg-black/75 hover:bg-primary text-white rounded-full p-1.5 transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
        {admin && item.status === "draft" && (
          <div className="absolute top-2 right-2 z-10 bg-foreground/80 text-background text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wide">
            Draft
          </div>
        )}

        {!admin && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              className="bg-white/15 backdrop-blur-sm border border-white/40 rounded-full p-3.5 shadow-2xl"
            >
              <Play className="w-7 h-7 text-white fill-white" />
            </motion.div>
          </div>
        )}

        <div className="absolute bottom-2 right-2 bg-black/75 text-xs px-1.5 py-0.5 rounded text-white tabular-nums">
          {item.duration}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-accent/0 via-accent to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="mt-2 space-y-0.5 px-0.5">
        <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors text-sm truncate">
          {item.title}
        </h4>
        {item.subtitle && (
          <p className="text-xs text-muted-foreground truncate">
            {item.subtitle}
          </p>
        )}
      </div>
    </motion.div>
  );
}
