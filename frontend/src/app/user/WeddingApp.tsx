import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api, setWeddingSlug } from "../api/client";
import type { WeddingInfo } from "../api/types";
import { applyTheme, resolveTheme } from "../lib/theme";
import { IntroAnimation } from "./IntroAnimation";
import { WhoIsWatching, type Profile } from "./WhoIsWatching";
import { UserPortal } from "./UserPortal";

const profileKey = (slug: string) => `wedflix.profile.${slug}`;
const introKey = (slug: string) => `wedflix.intro.${slug}`;

// Wraps a single wedding: points the API at its slug, plays the cinematic
// intro once per session, then shows the "Who's watching?" picker before
// the portal.
export function WeddingApp() {
  const { slug = "" } = useParams();
  // key forces a clean remount (and profile re-read) when the slug changes.
  return <WeddingShell key={slug} slug={slug} />;
}

function WeddingShell({ slug }: { slug: string }) {
  setWeddingSlug(slug);

  const [profile, setProfile] = useState<Profile | null>(() => {
    try {
      const raw = localStorage.getItem(profileKey(slug));
      return raw ? (JSON.parse(raw) as Profile) : null;
    } catch {
      return null;
    }
  });

  // Intro only plays once per session — skip the flicker for everyone after
  // the first visit.
  const [introDone, setIntroDone] = useState(
    () => sessionStorage.getItem(introKey(slug)) === "done",
  );

  // Fetch the wedding payload early so the intro can use the right brand
  // colour and name. /wedding is light (no content rows) so this is cheap.
  const [wedding, setWedding] = useState<WeddingInfo | null>(null);
  useEffect(() => {
    api<WeddingInfo>("/wedding")
      .then(setWedding)
      .catch(() => setWedding(null));
  }, [slug]);

  // Apply theme as soon as we know it — both the intro and every subsequent
  // screen render with the right colours/font.
  useEffect(() => {
    if (wedding) applyTheme(wedding.theme);
  }, [wedding]);

  if (!introDone) {
    // Hold a black screen while wedding loads (usually <300 ms) so the
    // intro animates in the right brand colour, not the default red.
    if (!wedding) return <div className="fixed inset-0 bg-black" />;
    const brand = resolveTheme(wedding.theme).brandName;
    return (
      <IntroAnimation
        brandName={brand}
        onDone={() => {
          sessionStorage.setItem(introKey(slug), "done");
          setIntroDone(true);
        }}
      />
    );
  }

  if (!profile) {
    return (
      <WhoIsWatching
        onPick={(p) => {
          localStorage.setItem(profileKey(slug), JSON.stringify(p));
          setProfile(p);
        }}
      />
    );
  }

  return (
    <UserPortal
      profileName={profile.name}
      onSwitchProfile={() => {
        localStorage.removeItem(profileKey(slug));
        setProfile(null);
      }}
    />
  );
}
