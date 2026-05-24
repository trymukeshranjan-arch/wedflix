import { useEffect, useRef } from "react";

// The platform intro video. Plays full-screen, with sound, no controls,
// then transitions to the portal. The component relies on the caller
// having already collected a user gesture (we mount this right after the
// "Who's watching?" profile tap) so browser autoplay-with-sound is
// unlocked.
//
// No UI elements — no skip, no mute toggle — so it feels like part of
// the product, not an attached video.

const VIDEO_SRC = "/intro.mp4";
// Hard ceiling — if the file errors or never loads we still want to
// advance the user. (Intro file is ~4s; 8s is plenty of headroom.)
const FAILSAFE_MS = 8000;

export function IntroAnimation({
  brandName: _brandName,
  onDone,
}: {
  brandName: string;
  onDone: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    // Caller has just gathered a user gesture; sound autoplay should be
    // unlocked. We don't fall back to muted — silent fall-back would feel
    // wrong for a brand intro. If the browser still blocks (rare), we
    // surface the failure via the failsafe rather than play silently.
    v.muted = false;
    v.play().catch(() => {
      // Last resort: don't strand the user; just continue.
      finish();
    });
  }, []);

  // Don't let a broken file trap the user.
  useEffect(() => {
    const t = setTimeout(finish, FAILSAFE_MS);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="fixed inset-0 z-[400] bg-black flex items-center justify-center select-none">
      <video
        ref={videoRef}
        src={VIDEO_SRC}
        playsInline
        preload="auto"
        className="w-full h-full object-contain pointer-events-none"
        onEnded={finish}
        onError={finish}
      />
    </div>
  );
}
