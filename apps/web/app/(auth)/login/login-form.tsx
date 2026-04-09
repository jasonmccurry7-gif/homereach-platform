"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface LoginFormProps {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}

export function LoginForm({ searchParams }: LoginFormProps) {
  const params = use(searchParams);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.error ?? null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      // Normalize Supabase error messages to user-friendly copy
      const msg =
        authError.message.toLowerCase().includes("invalid login")
          ? "Incorrect email or password. Please try again."
          : authError.message.toLowerCase().includes("email not confirmed")
          ? "Please confirm your email before signing in."
          : authError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    // ── Role-based routing ─────────────────────────────────────────────────
    // If a specific redirect was passed (e.g. from middleware), honour it.
    // Otherwise route by role: admin → /admin, sales_agent → /admin/agent-view,
    // everyone else → /dashboard.
    const role = data.user?.app_metadata?.user_role as string | undefined;

    let destination = params.redirect;
    if (!destination || destination === "/dashboard") {
      if (role === "admin") {
        destination = "/admin";
      } else if (role === "sales_agent") {
        destination = "/admin/agent-view";
      } else {
        destination = "/dashboard";
      }
    }

    router.push(destination);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-900/30 px-4 py-3 text-sm text-red-300">
          <span className="mt-0.5 shrink-0 text-base leading-none">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-sm font-medium text-gray-300 mb-1.5"
        >
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label htmlFor="password" className="block text-sm font-medium text-gray-300">
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
            tabIndex={-1}
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60 transition-colors"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v8z"
              />
            </svg>
            Signing in…
          </span>
        ) : (
          "Sign in"
        )}
      </button>
    </form>
  );
}
