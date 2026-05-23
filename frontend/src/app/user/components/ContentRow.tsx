import { useRef, useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { VideoCard } from "./VideoCard";
import type { ContentItem, ContentRowData } from "../../api/types";

export function ContentRow({
  row,
  onPlay,
  admin,
  onAdd,
  onEditItem,
  onDeleteItem,
}: {
  row: ContentRowData;
  onPlay: (item: ContentItem) => void;
  admin?: boolean;
  onAdd?: (rowTitle: string) => void;
  onEditItem?: (item: ContentItem) => void;
  onDeleteItem?: (item: ContentItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(true);

  const check = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 10);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 10);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    check();
    el?.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      el?.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [check]);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -580 : 580,
      behavior: "smooth",
    });
  };

  // In admin mode an empty row still renders so it can be managed.
  if (!row.items.length && !admin) return null;

  return (
    <div className="group/row relative py-2">
      <h3
        className="font-semibold mb-3 px-4 md:px-12 text-foreground"
        style={{
          fontFamily: "var(--font-heading)",
          fontSize:
            "clamp(1.05rem, 2.2vw, calc(1.35rem * var(--heading-scale)))",
        }}
      >
        {row.title}
      </h3>

      {canLeft && (
        <button
          onClick={() => scroll("left")}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-black/80 hover:bg-black p-2 rounded-r opacity-0 group-hover/row:opacity-100 transition-opacity h-20 flex items-center"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
      )}
      {canRight && (
        <button
          onClick={() => scroll("right")}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-black/80 hover:bg-black p-2 rounded-l opacity-0 group-hover/row:opacity-100 transition-opacity h-20 flex items-center"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      )}

      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto px-4 md:px-12 pb-3"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {row.items.map((item) => (
          <div
            key={item.id}
            className="flex-shrink-0"
            style={{ minWidth: "var(--card-min-w, 260px)" }}
          >
            <VideoCard
              item={item}
              onPlay={onPlay}
              admin={admin}
              onEdit={onEditItem}
              onDelete={onDeleteItem}
            />
          </div>
        ))}

        {admin && (
          <div className="min-w-[260px] sm:min-w-[290px] flex-shrink-0">
            <button
              onClick={() => onAdd?.(row.title)}
              className="w-full aspect-video rounded-md border-2 border-dashed border-border hover:border-accent flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-accent transition-colors"
            >
              <Plus className="w-8 h-8" />
              <span className="text-sm">Add to “{row.title}”</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
