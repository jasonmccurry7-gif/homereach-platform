"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });

    if (authError) {
      const msg =
        authError.message.toLowerCase().includes("already registered")
          ? "An account with this email already exists. Try signing in instead."
          : authError.message;
      setError(msg);
      setLoading(false);
      return;
    }

    // Show confirmation message — user needs to verify email
    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-900/40 border border-green-700/40 text-2xl">
          ✉️
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Check your inbox</h2>
          <p className="mt-1.5 text-sm text-gray-400">
            We sent a confirmation email to{" "}
            <span className="font-medium text-gray-300">{email}</span>.
            Click the link to activate your account.
          </p>
        </div>
        <Link
          href="/login"
          className="block text-sm text-blue-400 hover:text-blue-300 transition-colors"
        >
          Back to sign in →
        </Link>
      </div>
    );
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
        <label htmlFor="fullName" className="block text-sm font-medium text-gray-300 mb-1.5">
          Full name
        </label>
        <input
          id="fullName"
          type="text"
          required
          autoComplete="name"
          autoFocus
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Jane Smith"
          className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 shadow-sm transition-colors focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1.5">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
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
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Creating account…
          </span>
        ) : (
          "Create account"
        )}
      </button>

      <p className="text-xs text-center text-gray-500">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="text-blue-400 hover:underline">Terms</Link>
        {" "}and{" "}
        <Link href="/privacy" className="text-blue-400 hover:underline">Privacy Policy</Link>.
      </p>
    </form>
  );
}
