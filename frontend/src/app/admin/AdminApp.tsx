import { useAuth } from "../lib/auth";
import { AdminLogin } from "./AdminLogin";
import { AdminPortal } from "./AdminPortal";

export function AdminApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-[3px] border-white/15 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <AdminLogin />;
  return <AdminPortal />;
}
