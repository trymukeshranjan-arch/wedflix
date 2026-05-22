import { useState } from "react";
import { useAuth } from "../lib/auth";
import { ApiError } from "../api/client";

export function AdminLogin() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not sign in",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1
            className="text-3xl font-bold text-primary tracking-[0.2em]"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            WEDFLIX
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Studio Admin Portal
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-card border border-border rounded-xl p-6 space-y-4"
        >
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-accent transition-colors"
              placeholder="admin@wedflix.test"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground uppercase tracking-wider">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 w-full bg-background border border-border rounded px-3 py-2 outline-none focus:border-accent transition-colors"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold rounded py-2.5 transition-all disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground/60 mt-4">
          Demo login — admin@wedflix.test / admin123
        </p>
      </div>
    </div>
  );
}
