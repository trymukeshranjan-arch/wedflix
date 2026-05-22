import { useState } from "react";
import { useParams } from "react-router";
import { setWeddingSlug } from "../api/client";
import { WhoIsWatching, type Profile } from "./WhoIsWatching";
import { UserPortal } from "./UserPortal";

const profileKey = (slug: string) => `wedflix.profile.${slug}`;

// Wraps a single wedding: points the API at its slug, then shows the
// "Who's watching?" picker before the portal.
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
