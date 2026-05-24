import { useEffect, useState } from "react";
import { ArrowLeft, Play, Info, Download, Search, User } from "lucide-react";
import { AnimatePresence } from "motion/react";
import { Link, useNavigate } from "react-router";
import { api, ApiError, mediaUrl } from "../api/client";
import type { ContentItem, HomeData, WeddingInfo } from "../api/types";
import { resolveTheme } from "../lib/theme";
import { VideoPlayer } from "./components/VideoPlayer";
import { SearchOverlay } from "./components/SearchOverlay";
import { PortalStyles } from "./components/PortalStyles";

interface SeasonWithEpisodes {
  id: string;
  number: number;
  title: string;
  description: string | null;
  coverUrl: string | null;
  episodes: ContentItem[];
}

// Netflix-style title page: hero banner, wedding metadata, then an episode
// list grouped by season with a season selector.
export function SeasonsPage({
  profileName,
  onSwitchProfile,
}: {
  profileName?: string;
  onSwitchProfile?: () => void;
}) {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState<SeasonWithEpisodes[] | null>(null);
  const [wedding, setWedding] = useState<WeddingInfo | null>(null);
  const [home, setHome] = useState<HomeData | null>(null);
  const [activeVideo, setActiveVideo] = useState<ContentItem | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<SeasonWithEpisodes[]>("/wedding/seasons"),
      api<WeddingInfo>("/wedding"),
      api<HomeData>("/wedding/home"),
    ])
      .then(([s, w, h]) => {
        setSeasons(s);
        setWedding(w);
        setHome(h);
        if (s.length && !activeSeasonId) setActiveSeasonId(s[0].id);
      })
      .catch((e: ApiError) =>
        setError(e?.message ?? "Could not load seasons"),
      );
    // activeSeasonId intentionally not in deps — we set it once from server data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    document.body.style.overflow = activeVideo || searchOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [activeVideo, searchOpen]);

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-6 text-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  if (!seasons || !wedding) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-12 h-12 border-[3px] border-white/15 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const brand = resolveTheme(wedding.theme).brandName;
  const coupleTitle = `${wedding.coupleNameA} ∞ ${wedding.coupleNameB}`;
  const heroItem = home?.hero ?? null;
  const heroImage = heroItem?.thumbnail ? mediaUrl(heroItem.thumbnail) : null;
  const year = wedding.weddingDate
    ? new Date(wedding.weddingDate).getFullYear()
    : null;
  const activeSeason =
    seasons.find((s) => s.id === activeSeasonId) ?? seasons[0] ?? null;

  const download = (item: ContentItem) => {
    api<{ downloadUrl: string }>(`/content/${item.id}/download`)
      .then((r) => {
        // mediaUrl handles both absolute and relative URLs.
        const url = mediaUrl(r.downloadUrl);
        if (url) window.open(url, "_blank", "noopener");
      })
      .catch((e: ApiError) =>
        window.alert(
          e?.code === "forbidden"
            ? "Sign in to download this video."
            : e?.message ?? "Could not download",
        ),
      );
  };

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

      {/* Top nav (matches UserPortal so the experience feels continuous) */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 md:px-12 py-4 bg-background/95 backdrop-blur-md border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <button
              onClick={() => navigate(-1)}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1
              className="text-xl md:text-2xl font-bold text-primary tracking-[0.15em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {brand}
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSearchOpen(true)}
              className="hover:text-primary transition-colors"
              title="Search"
              aria-label="Search"
            >
              <Search className="w-5 h-5" />
            </button>
            {profileName && (
              <button
                onClick={onSwitchProfile}
                className="hidden sm:block text-sm text-foreground/70 hover:text-foreground transition-colors"
                title="Switch profile"
              >
                {profileName}
              </button>
            )}
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

      {/* Hero banner */}
      <div className="relative h-[60vh] min-h-[400px]">
        <div className="absolute inset-0">
          {heroImage ? (
            <img
              src={heroImage}
              alt={coupleTitle}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-card to-background" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-black/30" />
        </div>

        <div className="relative h-full flex items-end px-4 md:px-12 pb-12 pt-20">
          <div className="max-w-2xl space-y-4">
            <p className="text-xs text-accent font-semibold tracking-[0.35em] uppercase">
              A Wedding Original
            </p>
            <h2
              className="font-bold text-foreground leading-[1.05]"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize:
                  "clamp(2rem, 6vw, calc(3.5rem * var(--heading-scale)))",
              }}
            >
              {wedding.coupleNameA}{" "}
              <span className="text-accent">∞</span>{" "}
              {wedding.coupleNameB}
            </h2>
            <div className="flex flex-wrap gap-3 pt-2">
              {heroItem && (
                <button
                  onClick={() => setActiveVideo(heroItem)}
                  className="flex items-center gap-2 bg-white hover:bg-white/90 text-black px-6 py-2.5 rounded font-bold transition-all shadow-lg hover:scale-[1.03] active:scale-95"
                >
                  <Play className="w-4 h-4 fill-black" />
                  Play
                </button>
              )}
              <Link
                to=".."
                relative="path"
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white px-6 py-2.5 rounded font-semibold transition-all border border-white/25"
              >
                <Info className="w-4 h-4" />
                Home
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Metadata + tagline + starring */}
      <div className="px-4 md:px-12 py-6 max-w-3xl space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-foreground/80">
          {year && <span>{year}</span>}
          <span>
            {seasons.length} Season{seasons.length === 1 ? "" : "s"}
          </span>
          <span className="border border-border px-1.5 py-0.5 rounded text-xs">
            HD
          </span>
        </div>
        {wedding.tagline && (
          <p className="text-foreground/85">{wedding.tagline}</p>
        )}
        {wedding.starring && (
          <p className="text-foreground/65">
            <span className="text-foreground/45">Starring:</span>{" "}
            {wedding.starring}
          </p>
        )}
      </div>

      <div className="border-t border-border" />

      {/* Episodes */}
      <div className="px-4 md:px-12 py-8 pb-20">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h3
            className="text-2xl font-semibold"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Episodes
          </h3>
          {seasons.length > 1 && (
            <select
              value={activeSeason?.id ?? ""}
              onChange={(e) => setActiveSeasonId(e.target.value)}
              className="bg-background border border-border rounded px-4 py-2 text-sm focus:border-accent outline-none"
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>
                  Season {s.number}
                </option>
              ))}
            </select>
          )}
        </div>

        {seasons.length === 0 && (
          <p className="text-muted-foreground py-12 text-center">
            No seasons yet. The admin can group videos into seasons from the
            admin portal.
          </p>
        )}

        {activeSeason && (
          <>
            <div className="mb-6 flex items-baseline gap-3 flex-wrap">
              <p className="font-semibold text-lg">
                Season {activeSeason.number}: {activeSeason.title}
              </p>
              {activeSeason.description && (
                <p className="text-sm text-muted-foreground">
                  {activeSeason.description}
                </p>
              )}
            </div>

            {activeSeason.episodes.length === 0 ? (
              <p className="text-muted-foreground py-8 text-center">
                No episodes in this season yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {activeSeason.episodes.map((ep, i) => (
                  <li
                    key={ep.id}
                    className="grid grid-cols-[auto_minmax(140px,200px)_1fr_auto] items-center gap-4 p-3 rounded-lg hover:bg-foreground/5 transition-colors group"
                  >
                    <span className="text-2xl font-light text-muted-foreground w-8 text-center">
                      {i + 1}
                    </span>
                    <button
                      onClick={() => setActiveVideo(ep)}
                      className="relative aspect-video bg-muted rounded overflow-hidden group/thumb"
                    >
                      {ep.thumbnail && (
                        <img
                          src={mediaUrl(ep.thumbnail)}
                          alt=""
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                        <Play className="w-8 h-8 text-white fill-white" />
                      </div>
                    </button>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <button
                          onClick={() => setActiveVideo(ep)}
                          className="font-semibold text-foreground hover:text-accent transition-colors text-left"
                        >
                          {ep.title}
                        </button>
                        {ep.duration && ep.duration !== "0:00" && (
                          <span className="text-xs text-muted-foreground">
                            {ep.duration}
                          </span>
                        )}
                      </div>
                      {ep.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {ep.description}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => download(ep)}
                      className="text-muted-foreground hover:text-foreground p-2"
                      title="Download"
                      aria-label={`Download ${ep.title}`}
                    >
                      <Download className="w-5 h-5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <PortalStyles />
    </div>
  );
}
