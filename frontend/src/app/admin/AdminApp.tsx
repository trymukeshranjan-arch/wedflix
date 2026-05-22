import { useState } from "react";
import { useAuth } from "../lib/auth";
import { setWeddingSlug } from "../api/client";
import { AdminLogin } from "./AdminLogin";
import { AdminWeddingList } from "./AdminWeddingList";
import { AdminPortal } from "./AdminPortal";

export function AdminApp() {
  const { user, loading } = useAuth();
  const [slug, setSlug] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-white/15 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AdminLogin />;

  if (!slug) {
    return (
      <AdminWeddingList
        onPick={(s) => {
          setWeddingSlug(s);
          setSlug(s);
        }}
      />
    );
  }

  // key forces a clean remount when switching weddings.
  return <AdminPortal key={slug} onBack={() => setSlug(null)} />;
}
