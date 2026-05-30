import { useEffect, useState } from "react";
import { useParams, Routes, Route } from "react-router";
import { api, setProfileId, setWeddingSlug } from "../api/client";
import type { WeddingInfo } from "../api/types";
import { applyTheme, resolveTheme } from "../lib/theme";
import { IntroAnimation } from "./IntroAnimation";
import { WhoIsWatching, type Profile } from "./WhoIsWatching";
import { UserPortal } from "./UserPortal";
import { SeasonsPage } from "./SeasonsPage";

const profileKey = (slug: string) => `wedflix.profile.${slug}`;
const introKey = (slug: string) => `wedflix.intro.${slug}`;

// Wraps a single wedding. The flow matches Netflix:
//   1. "Who's watching?" picker — every visit until the intro has been
//      played this session. Picking a profile counts as the user gesture
//      that unlocks autoplay-with-sound for the intro.
//   2. Intro video — plays once per session, immediately after the pick.
//   3. Portal (home + nested routes).
//
// After the intro has played once this session, returning to the URL
// (e.g. via "switch profile") goes straight to the picker → portal with
// no intro replay.
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

  const [introDone, setIntroDone] = useState(
    () => sessionStorage.getItem(introKey(slug)) === "done",
  );
  // Set true between "user picked profile" and "intro finished" — that's
  // when the intro should be on screen, fed by a fresh user gesture.
  const [introPending, setIntroPending] = useState(false);

  // Fetch the wedding payload once so the picker and intro both have the
  // right brand colour and name to work with.
  const [wedding, setWedding] = useState<WeddingInfo | null>(null);
  useEffect(() => {
    api<WeddingInfo>("/wedding")
      .then(setWedding)
      .catch(() => setWedding(null));
  }, [slug]);

  useEffect(() => {
    if (wedding) applyTheme(wedding.theme);
  }, [wedding]);

  // Keep the api client's X-Profile-Id header in sync with the picked
  // profile — every request goes out tagged with the right viewer, and the
  // server uses it to filter per-profile-visible content.
  useEffect(() => {
    setProfileId(profile?.id ?? null);
    return () => setProfileId(null);
  }, [profile?.id]);

  const brand = wedding ? resolveTheme(wedding.theme).brandName : "WEDFLIX";

  // 1. Intro hasn't played this session yet — always show the picker first.
  //    Picking a profile sets `introPending` so the intro renders next.
  if (!introDone && !introPending) {
    return (
      <WhoIsWatching
        onPick={(p) => {
          localStorage.setItem(profileKey(slug), JSON.stringify(p));
          setProfile(p);
          setIntroPending(true);
        }}
      />
    );
  }

  // 2. Profile just picked — play the intro with sound (gesture is fresh).
  if (introPending) {
    return (
      <IntroAnimation
        brandName={brand}
        onDone={() => {
          sessionStorage.setItem(introKey(slug), "done");
          setIntroDone(true);
          setIntroPending(false);
        }}
      />
    );
  }

  // 3. Intro already played this session — if the user switched profiles,
  //    show the picker again (no intro). Otherwise jump to the portal.
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

  const onSwitch = () => {
    localStorage.removeItem(profileKey(slug));
    setProfile(null);
  };

  return (
    <Routes>
      <Route
        index
        element={
          <UserPortal profileName={profile.name} onSwitchProfile={onSwitch} />
        }
      />
      <Route
        path="seasons"
        element={
          <SeasonsPage profileName={profile.name} onSwitchProfile={onSwitch} />
        }
      />
    </Routes>
  );
}
