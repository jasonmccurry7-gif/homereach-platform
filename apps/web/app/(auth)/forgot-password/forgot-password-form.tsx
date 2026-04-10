"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "https://home-reach.com";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setErrorMsg(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/api/auth/callback?type=recovery&next=/reset-password`,
    });

    if (error) {
      setErrorMsg(error.message);
      setStatus("error");
      return;
    }

    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-900/40 border border-green-700/40 text-2xl">
          ✉️
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Check your inbox</h2>
          <p className="mt-1.5 text-sm text-gray-400">
            We sent a reset link to{" "}
            <span className="font-medium text-gray-300">{email}</span>.
            The link expires in 1 hour.
          </p>
        </div>
        <p className="text-xs text-gray-500">
          Didn&apos;t receive it? Check your spam folder or{" "}
          <button
            onClick={() => setStatus("idle")}
            className="text-blue-400 hover:underline"
          >
            try again
          </button>
          .
        </p>
        <Link
          href="/login"
          className="block text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          ← Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {status === "error" && errorMsg && (
        <div className="rounded-lg bg-red-900/30 border border-red-800/50 px-4 py-3 text-sm text-red-300">
          {errorMsg}
        </div>
      )}

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
          className="block w-full rounded-lg border border-gray-700 bg-gray-800 px-3.5 py-2.5 text-sm text-white placeholder-gray-500 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <button
        type="submit"
        disabled={status === "loading"}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-60 transition-colors"
      >
        {status === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Sending…
          </span>
        ) : (
          "Send reset link"
        )}
      </button>

      <p className="text-center text-sm text-gray-500">
        Remember your password?{" "}
        <Link href="/login" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
          Sign in
        </Link>
      </p>
    </form>
  );
}
