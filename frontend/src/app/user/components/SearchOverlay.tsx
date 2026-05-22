import { useState, useRef, useEffect } from "react";
import { Search, X } from "lucide-react";
import { motion } from "motion/react";
import { api } from "../../api/client";
import { VideoCard } from "./VideoCard";
import type { ContentItem } from "../../api/types";

export function SearchOverlay({
  onClose,
  onPlay,
}: {
  onClose: () => void;
  onPlay: (item: ContentItem) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContentItem[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  // Debounced server-side search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api<ContentItem[]>(`/content/search?q=${encodeURIComponent(q)}`)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="fixed inset-0 z-[150] bg-black/96 flex flex-col px-4 md:px-12 pt-8 md:pt-12"
    >
      <div className="flex items-center gap-4 border-b border-border pb-4 mb-8">
        <Search className="w-6 h-6 text-muted-foreground flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your memories..."
          className="flex-1 bg-transparent text-xl md:text-3xl outline-none text-foreground placeholder:text-muted-foreground"
        />
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="overflow-y-auto flex-1 pb-12">
        {searching && (
          <p className="text-muted-foreground text-center mt-16">
            Searching…
          </p>
        )}
        {!searching && query.trim().length >= 2 && results.length === 0 && (
          <p className="text-muted-foreground text-center mt-24 text-lg">
            No memories found for &quot;{query}&quot;
          </p>
        )}
        {results.length > 0 && (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {results.length} result{results.length !== 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {results.map((item) => (
                <VideoCard
                  key={item.id}
                  item={item}
                  onPlay={(v) => {
                    onPlay(v);
                    onClose();
                  }}
                />
              ))}
            </div>
          </>
        )}
        {query.trim().length < 2 && (
          <div className="text-center mt-24">
            <p className="text-muted-foreground text-lg">
              Start typing to search your wedding memories
            </p>
            <p className="text-muted-foreground/50 text-sm mt-2">
              Ceremonies, films, moments, emotional scenes…
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
