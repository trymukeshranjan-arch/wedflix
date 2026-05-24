import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

// Plays the platform intro video (~4s) once per session before "Who's
// watching?". The video file is bundled at /intro.mp4. We try to start
// playback with sound; if the browser blocks autoplay-with-sound (most do
// without a prior user gesture) we fall back to muted playback and surface
// an unmute button. Skipping or video end both fire onDone.

const VIDEO_SRC = "/intro.mp4";
// Cap how long we wait if the video never loads / errors — never trap users.
const FAILSAFE_MS = 7000;

export function IntroAnimation({
  brandName: _brandName,
  onDone,
}: {
  // brandName kept in the API so WeddingApp doesn't have to change; the
  // current intro file is global so it isn't read here. Underscore prefix
  // tells the build it's intentionally unused.
  brandName: string;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const [muted, setMuted] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  const skip = () => {
    setLeaving(true);
    // Short fade-out so a skip click never snaps to the next screen.
    setTimeout(finish, 200);
  };

  // Try sound-on, fall back to muted if the browser blocks autoplay.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    const tryPlay = async () => {
      try {
        await v.play();
      } catch {
        // Autoplay-with-sound blocked — retry muted (always allowed).
        v.muted = true;
        setMuted(true);
        try {
          await v.play();
        } catch {
          // Even muted play failed — bail to next screen rather than hang.
          finish();
        }
      }
    };
    tryPlay();
  }, []);

  // Failsafe: don't strand the user if the video stalls / errors silently.
  useEffect(() => {
    const t = setTimeout(finish, FAILSAFE_MS);
    return () => clearTimeout(t);
  }, []);

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  };

  return (
    <div
      className="fixed inset-0 z-[400] bg-black flex items-center justify-center select-none transition-opacity duration-500"
      style={{ opacity: leaving ? 0 : 1 }}
      onClick={skip}
    >
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        playsInline
        preload="auto"
        className="w-full h-full object-contain"
        onEnded={() => {
          // Fade then finish so the cut to the next screen isn't jarring.
          setLeaving(true);
          setTimeout(finish, 250);
        }}
        onError={finish}
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleMute();
        }}
        className="absolute bottom-6 left-6 bg-black/50 hover:bg-black/75 backdrop-blur-sm p-2.5 rounded-full border border-white/20 text-white transition-colors"
        title={muted ? "Unmute" : "Mute"}
        aria-label={muted ? "Unmute intro" : "Mute intro"}
      >
        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
      </button>

      <button
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
        className="absolute bottom-6 right-6 text-xs text-white/50 hover:text-white tracking-widest uppercase transition-colors"
        aria-label="Skip intro"
      >
        Skip ›
      </button>
    </div>
  );
}
