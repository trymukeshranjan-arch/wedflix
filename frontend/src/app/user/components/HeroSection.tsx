import { useRef, useState, useEffect } from "react";
import { Play, Info, VolumeX, Volume2, Pencil } from "lucide-react";
import { motion } from "motion/react";
import { mediaUrl } from "../../api/client";
import type { ContentItem, WeddingInfo } from "../../api/types";

export function HeroSection({
  wedding,
  hero,
  onPlay,
  admin,
  onEditHero,
}: {
  wedding: WeddingInfo;
  hero: ContentItem | null;
  onPlay: (item: ContentItem) => void;
  admin?: boolean;
  onEditHero?: () => void;
}) {
  const [heroMuted, setHeroMuted] = useState(true);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (heroVideoRef.current) heroVideoRef.current.muted = heroMuted;
  }, [heroMuted, hero]);

  return (
    <div className="relative h-screen min-h-[600px]">
      <div className="absolute inset-0">
        {hero?.preview ? (
          <video
            ref={heroVideoRef}
            src={mediaUrl(hero.preview)}
            poster={mediaUrl(hero.thumbnail)}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={mediaUrl(hero?.thumbnail) ?? ""}
            alt={`${wedding.coupleNameA} & ${wedding.coupleNameB}`}
            className="w-full h-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/55 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/20" />
      </div>

      {admin && (
        <button
          onClick={onEditHero}
          className="absolute top-24 right-4 md:right-12 z-20 flex items-center gap-2 bg-accent hover:bg-accent/90 text-accent-foreground text-sm font-semibold px-4 py-2 rounded shadow-lg"
        >
          <Pencil className="w-4 h-4" />
          Edit Hero
        </button>
      )}

      <div className="relative h-full flex items-center px-4 md:px-12 pt-20">
        <div className="max-w-xl space-y-5">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.9, ease: "easeOut" }}
            className="space-y-3"
          >
            <p className="text-xs text-accent font-semibold tracking-[0.35em] uppercase">
              A Wedding Original
            </p>
            <h2
              className="text-4xl md:text-6xl lg:text-[4.5rem] font-bold text-foreground leading-[1.05]"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {wedding.coupleNameA} <span className="text-accent">∞</span>{" "}
              {wedding.coupleNameB}
            </h2>
            {wedding.tagline && (
              <p className="text-sm md:text-base text-foreground/75 leading-relaxed max-w-md">
                {wedding.tagline}
              </p>
            )}
          </motion.div>

          {hero?.tags && hero.tags.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="flex flex-wrap gap-2 text-xs text-muted-foreground"
            >
              {hero.tags.map((t) => (
                <span
                  key={t}
                  className="border border-border px-3 py-1 rounded-full"
                >
                  {t}
                </span>
              ))}
            </motion.div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            className="flex flex-wrap gap-3 pt-1"
          >
            {hero && (
              <button
                onClick={() => onPlay(hero)}
                className="flex items-center gap-2 bg-white hover:bg-white/90 text-black px-7 py-3 rounded font-bold transition-all shadow-lg hover:scale-[1.03] active:scale-95"
              >
                <Play className="w-5 h-5 fill-black" />
                Play
              </button>
            )}
            <button
              onClick={() => hero && onPlay(hero)}
              className="flex items-center gap-2 bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white px-7 py-3 rounded font-semibold transition-all border border-white/25 hover:scale-[1.03] active:scale-95"
            >
              <Info className="w-5 h-5" />
              More Info
            </button>
          </motion.div>
        </div>
      </div>

      {hero?.preview && (
        <button
          onClick={() => setHeroMuted((m) => !m)}
          className="absolute bottom-28 md:bottom-36 right-4 md:right-12 bg-black/50 hover:bg-black/75 backdrop-blur-sm p-3 rounded-full border border-white/25 transition-all"
          title={heroMuted ? "Unmute" : "Mute"}
        >
          {heroMuted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>
      )}
    </div>
  );
}
