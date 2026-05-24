import { useEffect, useRef, useState } from "react";

// Cinematic 3-second intro that plays once per session before a wedding's
// "Who's watching?" screen.
//
// Pure SVG + CSS so it stays tiny (~3 KB), respects the wedding's primary
// colour via --primary, and never depends on a video asset. Skippable at
// any point.
//
// Timeline (ms):
//   0    – black scene, halo fades up
//   400  – W strokes start drawing
//   1500 – W finishes; flash bursts behind it
//   1900 – brand subtitle fades in
//   2700 – whole scene fades out
//   3400 – onDone fires
const TOTAL_MS = 3400;

export function IntroAnimation({
  brandName,
  onDone,
}: {
  brandName: string;
  onDone: () => void;
}) {
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  const skip = () => {
    setLeaving(true);
    // Short fade so a skip click never snaps to the next screen.
    setTimeout(finish, 200);
  };

  useEffect(() => {
    // Trigger the global fade-out shortly before completion so onDone
    // lines up with the last visible frame.
    const fadeT = setTimeout(() => setLeaving(true), TOTAL_MS - 700);
    const doneT = setTimeout(finish, TOTAL_MS);
    return () => {
      clearTimeout(fadeT);
      clearTimeout(doneT);
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[400] bg-black flex flex-col items-center justify-center select-none transition-opacity duration-700"
      style={{ opacity: leaving ? 0 : 1 }}
      onClick={skip}
    >
      <style>{`
        @keyframes wedflix-halo {
          from { opacity: 0; transform: scale(0.7); }
          25%  { opacity: 0.45; transform: scale(1); }
          70%  { opacity: 0.25; }
          to   { opacity: 0; transform: scale(1.6); }
        }
        @keyframes wedflix-draw {
          from { stroke-dashoffset: 1000; }
          to   { stroke-dashoffset: 0; }
        }
        @keyframes wedflix-fill {
          from { fill-opacity: 0; }
          to   { fill-opacity: 1; }
        }
        @keyframes wedflix-flash {
          0%, 100% { opacity: 0; transform: scale(0.4); }
          12%      { opacity: 0.9; transform: scale(1); }
          40%      { opacity: 0; transform: scale(2.2); }
        }
        @keyframes wedflix-rise {
          from { opacity: 0; transform: translateY(10px); letter-spacing: 0.6em; }
          to   { opacity: 1; transform: translateY(0);    letter-spacing: 0.35em; }
        }
        .wedflix-halo {
          position: absolute;
          width: 70vmin; height: 70vmin;
          border-radius: 50%;
          background: radial-gradient(closest-side, var(--primary) 0%, transparent 70%);
          animation: wedflix-halo 2200ms ease-out forwards;
          pointer-events: none;
        }
        .wedflix-flash {
          position: absolute;
          width: 90vmin; height: 90vmin;
          border-radius: 50%;
          background: radial-gradient(closest-side, white 0%, transparent 65%);
          animation: wedflix-flash 900ms ease-out 1500ms forwards;
          mix-blend-mode: screen;
          pointer-events: none;
          opacity: 0;
        }
        .wedflix-w-stroke {
          stroke-dasharray: 1000;
          stroke-dashoffset: 1000;
          animation: wedflix-draw 1100ms cubic-bezier(0.65, 0, 0.35, 1) 400ms forwards;
        }
        .wedflix-w-fill {
          fill-opacity: 0;
          animation: wedflix-fill 600ms ease-out 1500ms forwards;
        }
        .wedflix-subtitle {
          opacity: 0;
          animation: wedflix-rise 800ms ease-out 1900ms forwards;
        }
      `}</style>

      <div className="wedflix-halo" />
      <div className="wedflix-flash" />

      <svg
        viewBox="0 0 240 200"
        className="relative w-[min(70vmin,520px)] h-auto"
        aria-hidden="true"
      >
        {/* Stroke layer draws the outline of the W with a tracing animation. */}
        <path
          d="M 20 30 L 75 170 L 120 70 L 165 170 L 220 30"
          fill="none"
          stroke="var(--primary, #E50914)"
          strokeWidth="22"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="wedflix-w-stroke"
        />
        {/* Fill layer pops in after the stroke completes for a solid letter. */}
        <path
          d="M 20 30 L 75 170 L 120 70 L 165 170 L 220 30"
          fill="var(--primary, #E50914)"
          stroke="none"
          strokeLinejoin="round"
          className="wedflix-w-fill"
        />
      </svg>

      <p
        className="wedflix-subtitle mt-8 text-white text-sm md:text-base font-semibold uppercase"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        {brandName}
      </p>

      <button
        onClick={(e) => {
          e.stopPropagation();
          skip();
        }}
        className="absolute bottom-6 right-6 text-xs text-white/40 hover:text-white/80 tracking-widest uppercase transition-colors"
        aria-label="Skip intro"
      >
        Skip ›
      </button>
    </div>
  );
}
