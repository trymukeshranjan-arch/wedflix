import { useState, useEffect, useCallback } from "react";
import {
  Plus,
  Pencil,
  ExternalLink,
  LogOut,
  ArrowLeft,
  Users,
  Palette,
  Layers,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../lib/auth";
import type { ContentItem, HomeData } from "../api/types";
import { HeroSection } from "../user/components/HeroSection";
import { ContentRow } from "../user/components/ContentRow";
import { VideoPlayer } from "../user/components/VideoPlayer";
import { PortalStyles } from "../user/components/PortalStyles";
import { ContentEditModal, type EditTarget } from "./ContentEditModal";
import { WeddingInfoModal } from "./WeddingInfoModal";
import { ProfilesModal } from "./ProfilesModal";
import { ThemeModal } from "./ThemeModal";
import { SeasonsModal } from "./SeasonsModal";
import { applyTheme, resolveTheme } from "../lib/theme";

// The admin portal mirrors the user portal exactly — same hero, rows and
// cards — and overlays Edit / Add / Delete controls on everything.
export function AdminPortal({ onBack }: { onBack?: () => void }) {
  const { logout } = useAuth();
  const [home, setHome] = useState<HomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeVideo, setActiveVideo] = useState<ContentItem | null>(null);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [weddingModal, setWeddingModal] = useState(false);
  const [profilesOpen, setProfilesOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [seasonsOpen, setSeasonsOpen] = useState(false);

  const load = useCallback(() => {
    api<HomeData>("/admin/home")
      .then(setHome)
      .catch((e: ApiError) =>
        setError(e?.message ?? "Could not load the wedding"),
      );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Apply this wedding's theme to :root so the admin portal previews exactly
  // what users will see.
  useEffect(() => {
    applyTheme(home?.wedding.theme);
  }, [home?.wedding.theme]);

  useEffect(() => {
    document.body.style.overflow = activeVideo ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeVideo]);

  const refetch = () => {
    setEditTarget(null);
    setWeddingModal(false);
    load();
  };

  const deleteItem = async (item: ContentItem) => {
    if (!window.confirm(`Delete “${item.title}” permanently?`)) return;
    try {
      await api(`/admin/content/${item.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      window.alert(e instanceof ApiError ? e.message : "Delete failed");
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center gap-3 px-6 text-center">
        <h1
          className="text-3xl font-bold text-primary tracking-[0.15em]"
          style={{ fontFamily: "var(--font-heading)" }}
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
        <div className="w-12 h-12 border-[3px] border-white/15 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const { wedding, hero, rows } = home;
  const brand = resolveTheme(wedding.theme).brandName;
  const btn =
    "flex items-center gap-1.5 text-sm rounded px-3 py-1.5 transition-colors";

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

      {editTarget && (
        <ContentEditModal
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={refetch}
        />
      )}
      {weddingModal && (
        <WeddingInfoModal
          wedding={wedding}
          onClose={() => setWeddingModal(false)}
          onSaved={refetch}
        />
      )}
      {profilesOpen && (
        <ProfilesModal onClose={() => setProfilesOpen(false)} />
      )}
      {themeOpen && (
        <ThemeModal
          wedding={wedding}
          onClose={() => setThemeOpen(false)}
          onSaved={() => {
            setThemeOpen(false);
            load();
          }}
        />
      )}
      {seasonsOpen && (
        <SeasonsModal onClose={() => setSeasonsOpen(false)} />
      )}

      {/* Admin bar */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-8 py-3 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <h1
              className="text-xl md:text-2xl font-bold text-primary tracking-[0.15em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {brand}
            </h1>
            <span className="text-[10px] font-bold bg-accent/15 text-accent px-2 py-0.5 rounded-full tracking-wider">
              ADMIN
            </span>
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground ml-1"
                title="All weddings"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="hidden md:inline">Weddings</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={() => setEditTarget({ mode: "create" })}
              className={`${btn} bg-primary hover:bg-primary/90 text-white font-semibold`}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Content</span>
            </button>
            <button
              onClick={() => setProfilesOpen(true)}
              className={`${btn} text-muted-foreground hover:text-foreground hover:bg-foreground/5`}
            >
              <Users className="w-4 h-4" />
              <span className="hidden md:inline">Profiles</span>
            </button>
            <button
              onClick={() => setSeasonsOpen(true)}
              className={`${btn} text-muted-foreground hover:text-foreground hover:bg-foreground/5`}
            >
              <Layers className="w-4 h-4" />
              <span className="hidden md:inline">Seasons</span>
            </button>
            <button
              onClick={() => setWeddingModal(true)}
              className={`${btn} text-muted-foreground hover:text-foreground hover:bg-foreground/5`}
            >
              <Pencil className="w-4 h-4" />
              <span className="hidden md:inline">Couple Info</span>
            </button>
            <button
              onClick={() => setThemeOpen(true)}
              className={`${btn} text-muted-foreground hover:text-foreground hover:bg-foreground/5`}
            >
              <Palette className="w-4 h-4" />
              <span className="hidden md:inline">Theme</span>
            </button>
            <a
              href={`/w/${wedding.slug}`}
              target="_blank"
              rel="noreferrer"
              className={`${btn} text-muted-foreground hover:text-foreground hover:bg-foreground/5`}
            >
              <ExternalLink className="w-4 h-4" />
              <span className="hidden md:inline">View Site</span>
            </a>
            <button
              onClick={logout}
              className={`${btn} text-muted-foreground hover:text-primary hover:bg-foreground/5`}
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </nav>

      <HeroSection
        wedding={wedding}
        hero={hero}
        onPlay={setActiveVideo}
        admin
        onEditHero={() =>
          setEditTarget(
            hero
              ? { mode: "edit", item: hero, isHero: true }
              : { mode: "create" },
          )
        }
      />

      <div className="relative -mt-28 z-10 space-y-6 pb-16">
        {rows.length === 0 && (
          <p className="text-center text-muted-foreground py-16">
            No rows yet — click “Add Content” to create your first one.
          </p>
        )}
        {rows.map((row) => (
          <ContentRow
            key={row.id}
            row={row}
            onPlay={setActiveVideo}
            admin
            onAdd={(rowTitle) =>
              setEditTarget({ mode: "create", row: rowTitle })
            }
            onEditItem={(item) =>
              setEditTarget({
                mode: "edit",
                item,
                row: row.title,
                isHero: item.id === hero?.id,
              })
            }
            onDeleteItem={deleteItem}
          />
        ))}
      </div>

      <footer className="border-t border-border px-4 md:px-12 py-8">
        <p className="text-center text-xs text-muted-foreground/60">
          {brand} Admin — changes here go live on the user portal instantly.
        </p>
      </footer>

      <PortalStyles />
    </div>
  );
}
