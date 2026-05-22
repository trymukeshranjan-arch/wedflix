import { useState, useEffect } from "react";
import { api, mediaUrl } from "../api/client";

export interface Profile {
  id: string;
  name: string;
  avatarUrl: string | null;
}

function Smiley() {
  return (
    <svg viewBox="0 0 100 100" className="w-1/2 h-1/2" fill="none">
      <circle cx="34" cy="40" r="7.5" fill="white" />
      <circle cx="66" cy="40" r="7.5" fill="white" />
      <path
        d="M30 58 Q50 80 70 58"
        stroke="white"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// Netflix-style profile picker shown when entering a wedding.
export function WhoIsWatching({
  onPick,
}: {
  onPick: (profile: Profile) => void;
}) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);

  useEffect(() => {
    api<Profile[]>("/wedding/profiles")
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <h1
        className="text-3xl md:text-5xl lg:text-6xl text-white font-light mb-10 md:mb-14 text-center"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        Who&apos;s watching?
      </h1>

      {profiles === null ? (
        <div className="w-10 h-10 border-[3px] border-white/15 border-t-primary rounded-full animate-spin" />
      ) : profiles.length === 0 ? (
        <p className="text-white/60">
          No profiles set up for this wedding yet.
        </p>
      ) : (
        <div className="flex flex-wrap gap-5 md:gap-8 justify-center max-w-3xl">
          {profiles.map((p) => (
            <button
              key={p.id}
              onClick={() => onPick(p)}
              className="group flex flex-col items-center gap-3"
            >
              <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-xl overflow-hidden bg-gradient-to-b from-[#e8584f] to-[#c4392f] flex items-center justify-center ring-white transition-all duration-200 group-hover:ring-4 group-hover:scale-105">
                {p.avatarUrl ? (
                  <img
                    src={mediaUrl(p.avatarUrl)}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Smiley />
                )}
              </div>
              <span className="text-base md:text-lg text-white/55 group-hover:text-white transition-colors">
                {p.name}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
