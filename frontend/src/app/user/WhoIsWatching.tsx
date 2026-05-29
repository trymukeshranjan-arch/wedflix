import { useState, useEffect, useRef } from "react";
import { Lock } from "lucide-react";
import { api, ApiError, mediaUrl } from "../api/client";

export interface Profile {
  id: string;
  name: string;
  avatarUrl: string | null;
  hasPin?: boolean;
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

// Netflix-style profile picker shown when entering a wedding. Profiles with a
// PIN prompt for it before they can be opened.
export function WhoIsWatching({
  onPick,
}: {
  onPick: (profile: Profile) => void;
}) {
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [locked, setLocked] = useState<Profile | null>(null);

  useEffect(() => {
    api<Profile[]>("/wedding/profiles")
      .then(setProfiles)
      .catch(() => setProfiles([]));
  }, []);

  const choose = (p: Profile) => {
    if (p.hasPin) setLocked(p);
    else onPick(p);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6">
      <h1
        className="text-3xl md:text-5xl lg:text-6xl text-white font-light mb-10 md:mb-14 text-center"
        style={{ fontFamily: "var(--font-heading)" }}
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
              onClick={() => choose(p)}
              className="group flex flex-col items-center gap-3"
            >
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-36 md:h-36 rounded-xl overflow-hidden bg-gradient-to-b from-[#e8584f] to-[#c4392f] flex items-center justify-center ring-white transition-all duration-200 group-hover:ring-4 group-hover:scale-105">
                {p.avatarUrl ? (
                  <img
                    src={mediaUrl(p.avatarUrl)}
                    alt={p.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Smiley />
                )}
                {p.hasPin && (
                  <div className="absolute top-1.5 right-1.5 bg-black/60 rounded-full p-1.5">
                    <Lock className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
              <span className="text-base md:text-lg text-white/55 group-hover:text-white transition-colors">
                {p.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {locked && (
        <PinPrompt
          profile={locked}
          onCancel={() => setLocked(null)}
          onSuccess={() => {
            const p = locked;
            setLocked(null);
            onPick(p);
          }}
        />
      )}
    </div>
  );
}

// 4-box PIN entry overlay. Auto-advances between boxes and submits on the
// fourth digit. Verifies against the server; never stores the PIN.
function PinPrompt({
  profile,
  onCancel,
  onSuccess,
}: {
  profile: Profile;
  onCancel: () => void;
  onSuccess: () => void;
}) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const submit = async (pin: string) => {
    setChecking(true);
    setError(false);
    try {
      await api(`/wedding/profiles/${profile.id}/verify-pin`, {
        method: "POST",
        body: { pin },
      });
      onSuccess();
    } catch (e) {
      // Wrong PIN (403) or any failure → shake + clear.
      setError(true);
      setDigits(["", "", "", ""]);
      inputs.current[0]?.focus();
      if (!(e instanceof ApiError)) {
        // network/other — surface nothing extra; the shake conveys failure.
      }
    } finally {
      setChecking(false);
    }
  };

  const setDigit = (i: number, val: string) => {
    const d = val.replace(/\D/g, "").slice(-1); // keep last typed digit only
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    setError(false);
    if (d && i < 3) inputs.current[i + 1]?.focus();
    if (next.every((x) => x) && next.join("").length === 4) {
      submit(next.join(""));
    }
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
    if (e.key === "Escape") onCancel();
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/85 flex flex-col items-center justify-center px-6">
      <div className="bg-black/60 p-2 rounded-full mb-5">
        <Lock className="w-6 h-6 text-white/80" />
      </div>
      <p className="text-white/90 text-lg mb-1">
        Enter PIN for{" "}
        <span className="font-semibold">{profile.name}</span>
      </p>
      <p className="text-white/40 text-sm mb-6">
        This profile is locked.
      </p>

      <div
        className={`flex gap-3 ${error ? "wedflix-shake" : ""}`}
        aria-label="PIN entry"
      >
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              inputs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => onKeyDown(i, e)}
            inputMode="numeric"
            type="password"
            maxLength={1}
            disabled={checking}
            className={`w-14 h-16 md:w-16 md:h-20 text-center text-2xl rounded-lg bg-white/10 border-2 outline-none text-white transition-colors ${
              error
                ? "border-primary"
                : "border-white/20 focus:border-accent"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-primary text-sm mt-4">
          Incorrect PIN. Try again.
        </p>
      )}

      <button
        onClick={onCancel}
        className="mt-8 text-white/50 hover:text-white text-sm transition-colors"
      >
        Cancel
      </button>

      <style>{`
        @keyframes wedflix-shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        .wedflix-shake { animation: wedflix-shake 0.4s ease; }
      `}</style>
    </div>
  );
}
