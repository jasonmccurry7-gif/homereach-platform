import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign In — HomeReach" };

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Left panel — brand */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-gradient-to-br from-blue-950 via-blue-900 to-gray-900 p-12 border-r border-blue-800/30">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-sm shadow-lg">
            HR
          </div>
          <span className="text-lg font-bold text-white">HomeReach</span>
        </Link>

        <div className="space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-400 mb-3">
              Local marketing that works
            </p>
            <h2 className="text-4xl font-black text-white leading-tight">
              Your business,<br />
              in every<br />
              neighborhood.
            </h2>
            <p className="mt-4 text-lg text-blue-200/80 leading-relaxed">
              Postcards, digital ads, and automation — reaching 2,500+ homes in
              your city, every month.
            </p>
          </div>

          {/* Social proof */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { value: "2,500+", label: "Homes reached/drop" },
              { value: "1 per city", label: "Category exclusive" },
              { value: "3–5×", label: "Avg ROAS" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-blue-700/30 bg-blue-900/20 px-4 py-3 text-center"
              >
                <p className="text-2xl font-black text-white">{stat.value}</p>
                <p className="mt-0.5 text-xs text-blue-300/70">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-blue-400/50">
          © {new Date().getFullYear()} HomeReach. All rights reserved.
        </p>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="mb-8 flex flex-col items-center gap-3 lg:hidden">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-lg shadow-lg">
            HR
          </div>
          <span className="text-xl font-bold text-white">HomeReach</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Welcome back</h1>
            <p className="mt-1 text-sm text-gray-400">
              Sign in to your HomeReach account
            </p>
          </div>

          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
            <LoginForm searchParams={searchParams} />
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t have an account?{" "}
            <Link
              href="/get-started"
              className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Claim your spot →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
