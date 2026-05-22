import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Maximize2,
  Minimize2,
  Heart,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { api, mediaUrl } from "../../api/client";
import type { ContentItem, PlaybackData } from "../../api/types";

const fmt = (t: number) => {
  if (isNaN(t) || !isFinite(t)) return "0:00";
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
};

export function VideoPlayer({
  item,
  onClose,
}: {
  item: ContentItem;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>();

  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showCtrl, setShowCtrl] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [liked, setLiked] = useState(false);

  // Fetch a signed playback URL for this content item.
  useEffect(() => {
    let active = true;
    api<PlaybackData>(`/content/${item.id}/playback`)
      .then((d) => active && setSrc(mediaUrl(d.src) ?? null))
      .catch(
        (e) =>
          active &&
          setError(e?.message ?? "This video cannot be played right now"),
      );
    return () => {
      active = false;
    };
  }, [item.id]);

  useEffect(() => {
    const onChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const wakeControls = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowCtrl(false);
    }, 3000);
  }, []);

  useEffect(() => {
    wakeControls();
    return () => clearTimeout(hideTimer.current);
  }, [wakeControls]);

  const toggleFs = useCallback(async () => {
    if (!wrapRef.current) return;
    if (!document.fullscreenElement) {
      await wrapRef.current.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const v = videoRef.current;
      if (e.key === "Escape") return onClose();
      if (!v) return;
      if (e.key === " ") {
        e.preventDefault();
        if (v.paused) {
          v.play();
          setPlaying(true);
        } else {
          v.pause();
          setPlaying(false);
        }
        wakeControls();
      }
      if (e.key === "ArrowLeft")
        v.currentTime = Math.max(v.currentTime - 10, 0);
      if (e.key === "ArrowRight")
        v.currentTime = Math.min(v.currentTime + 10, v.duration || 0);
      if (e.key === "m" || e.key === "M") {
        v.muted = !v.muted;
        setMuted(v.muted);
      }
      if (e.key === "f" || e.key === "F") toggleFs();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, wakeControls, toggleFs]);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
    wakeControls();
  };

  const setVol = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    setVolume(val);
    v.muted = val === 0;
    setMuted(val === 0);
  };

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <motion.div
      ref={wrapRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex items-center justify-center"
      onMouseMove={wakeControls}
      style={{ cursor: showCtrl ? "default" : "none" }}
    >
      {src && (
        <video
          ref={videoRef}
          src={src}
          autoPlay
          className="w-full h-full object-contain"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onLoadedData={() => setLoading(false)}
          onWaiting={() => setLoading(true)}
          onCanPlay={() => setLoading(false)}
          onError={() =>
            setError("This video could not be loaded right now.")
          }
          onClick={togglePlay}
          playsInline
        />
      )}

      {(loading || !src) && !error && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-14 h-14 border-[3px] border-white/20 border-t-primary rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-6">
          <p className="text-white/80">{error}</p>
          <button
            onClick={onClose}
            className="bg-white/15 hover:bg-white/25 px-5 py-2 rounded text-sm"
          >
            Close
          </button>
        </div>
      )}

      <AnimatePresence>
        {showCtrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 flex flex-col justify-between"
            style={{ pointerEvents: "none" }}
          >
            <div
              className="flex items-start justify-between px-4 md:px-8 pt-4 md:pt-6 pb-16 bg-gradient-to-b from-black/80 to-transparent"
              style={{ pointerEvents: "auto" }}
            >
              <div>
                <h2
                  className="text-lg md:text-2xl font-bold text-white leading-tight"
                  style={{ fontFamily: "'Playfair Display', serif" }}
                >
                  {item.title}
                </h2>
                {item.subtitle && (
                  <p className="text-xs md:text-sm text-white/60 mt-0.5">
                    {item.subtitle}
                  </p>
                )}
              </div>
              <button
                onClick={onClose}
                className="ml-4 flex-shrink-0 bg-black/50 hover:bg-white/20 rounded-full p-2 transition-colors text-white"
                title="Close (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div
              className="px-4 md:px-8 pb-4 md:pb-6 pt-16 bg-gradient-to-t from-black/90 to-transparent"
              style={{ pointerEvents: "auto" }}
            >
              <div className="mb-3">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => {
                    const v = videoRef.current;
                    if (v) v.currentTime = parseFloat(e.target.value);
                    setCurrentTime(parseFloat(e.target.value));
                  }}
                  className="wedflix-seek w-full cursor-pointer"
                  style={{ "--pct": `${pct}%` } as React.CSSProperties}
                />
                <div className="flex justify-between text-xs text-white/50 mt-1">
                  <span>{fmt(currentTime)}</span>
                  <span>{fmt(duration)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 md:gap-5">
                  <button
                    onClick={togglePlay}
                    className="bg-white hover:bg-white/90 text-black rounded-full p-2.5 transition-all active:scale-90 shadow-lg"
                  >
                    {playing ? (
                      <Pause className="w-5 h-5 fill-black" />
                    ) : (
                      <Play className="w-5 h-5 fill-black" />
                    )}
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const v = videoRef.current;
                        if (!v) return;
                        v.muted = !v.muted;
                        setMuted(v.muted);
                      }}
                      className="text-white hover:text-primary transition-colors"
                    >
                      {muted || volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.02}
                      value={muted ? 0 : volume}
                      onChange={(e) => setVol(parseFloat(e.target.value))}
                      className="wedflix-vol w-20 cursor-pointer hidden md:block"
                      style={
                        {
                          "--pct": `${(muted ? 0 : volume) * 100}%`,
                        } as React.CSSProperties
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setLiked((l) => !l)}
                    className="transition-all active:scale-90"
                  >
                    <Heart
                      className={`w-5 h-5 transition-all ${
                        liked
                          ? "fill-primary text-primary scale-110"
                          : "text-white hover:text-primary"
                      }`}
                    />
                  </button>
                  <button
                    onClick={toggleFs}
                    className="text-white hover:text-primary transition-colors"
                  >
                    {fullscreen ? (
                      <Minimize2 className="w-5 h-5" />
                    ) : (
                      <Maximize2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
