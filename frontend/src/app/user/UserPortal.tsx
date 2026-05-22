import { useState, useEffect } from "react";
import { Search, User } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Link } from "react-router";
import { api, ApiError } from "../api/client";
import type { ContentItem, HomeData } from "../api/types";
import { HeroSection } from "./components/HeroSection";
import { ContentRow } from "./components/ContentRow";
import { VideoPlayer } from "./components/VideoPlayer";
import { SearchOverlay } from "./components/SearchOverlay";
import { PortalStyles } from "./components/PortalStyles";

export function UserPortal() {
  const [home, setHome] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<ContentItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpaque, setNavOpaque] = useState(false);

  useEffect(() => {
    api<HomeData>("/wedding/home")
      .then(setHome)
      .catch((e: ApiError) =>
        setError(e?.message ?? "Could not load this wedding"),
      );
  }, []);

  useEffect(() => {
    const onScroll = () => setNavOpaque(window.scrollY > 60);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow =
      activeVideo || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeVideo, searchOpen]);

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h1
          className="text-3xl font-bold text-primary tracking-[0.15em]"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          WEDFLIX
        </h1>
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!home) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-[3px] border-white/15 border-t-primary rounded-full animate-spin" />
          <p
            className="text-primary tracking-[0.3em] text-sm"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            WEDFLIX
          </p>
        </div>
      </div>
    );
  }

  const { wedding, hero, rows } = home;
  const coupleTitle = `${wedding.coupleNameA} ∞ ${wedding.coupleNameB}`;

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <AnimatePresence>
        {activeVideo && (
          <VideoPlayer
            item={activeVideo}
            onClose={() => setActiveVideo(null)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {searchOpen && (
          <SearchOverlay
            onClose={() => setSearchOpen(false)}
            onPlay={(v) => {
              setActiveVideo(v);
              setSearchOpen(false);
            }}
          />
        )}
      </AnimatePresence>

      <nav
        className={`fixed top-0 left-0 right-0 z-50 px-4 md:px-12 py-4 transition-all duration-500 ${
          navOpaque
            ? "bg-background/95 backdrop-blur-md shadow-lg"
            : "bg-gradient-to-b from-black/80 to-transparent"
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <h1
              className="text-2xl md:text-3xl font-bold text-primary tracking-[0.15em]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              WEDFLIX
            </h1>
            <div className="hidden md:flex items-center gap-6 text-sm text-foreground/70">
              <a href="#" className="hover:text-foreground transition-colors">
                Home
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Seasons
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Films
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Moments
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="hover:text-primary transition-colors"
              title="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            <Link
              to="/admin"
              className="hover:text-primary transition-colors"
              title="Admin"
            >
              <User className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </nav>

      <HeroSection wedding={wedding} hero={hero} onPlay={setActiveVideo} />

      <div className="relative -mt-28 z-10 space-y-6 pb-16">
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            No memories published yet.
          </p>
        )}
        {rows.map((row) => (
          <ContentRow key={row.id} row={row} onPlay={setActiveVideo} />
        ))}
      </div>

      <footer className="border-t border-border px-4 md:px-12 py-12">
        <div className="max-w-7xl mx-auto text-center space-y-2">
          <h3
            className="text-2xl font-bold text-primary tracking-widest"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            WEDFLIX
          </h3>
          <p className="text-sm text-muted-foreground">{coupleTitle}</p>
          <p className="text-xs text-muted-foreground/60 pt-4">
            This is not where memories are stored. This is where they live
            forever.
          </p>
        </div>
      </footer>

      <PortalStyles />
    </div>
  );
}
