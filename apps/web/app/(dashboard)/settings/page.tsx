import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, profiles } from "@homereach/db";
import { eq } from "drizzle-orm";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings — HomeReach" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account details and notification preferences.
        </p>
      </div>

      <div className="space-y-6">
        {/* Profile card */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Profile</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              Your name and contact info shown to the HomeReach team.
            </p>
          </div>
          <div className="p-6">
            <SettingsForm
              userId={user.id}
              defaultValues={{
                fullName: profile?.fullName ?? "",
                phone: profile?.phone ?? "",
              }}
            />
          </div>
        </section>

        {/* Email (read-only — managed by Supabase Auth) */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Email address</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              Used for login and campaign notifications.
            </p>
          </div>
          <div className="p-6">
            <div className="flex items-center justify-between rounded-xl bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-sm font-medium text-gray-700">{user.email}</p>
              <span className="text-xs text-gray-400">Managed by account login</span>
            </div>
            <p className="mt-3 text-xs text-gray-400">
              To change your email, contact{" "}
              <a
                href="mailto:support@homereach.com"
                className="text-blue-600 hover:underline"
              >
                support@homereach.com
              </a>
              .
            </p>
          </div>
        </section>

        {/* Account role */}
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Account type</h2>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 border border-blue-200 capitalize">
                {profile?.role ?? "client"}
              </span>
              <p className="text-sm text-gray-500">
                {profile?.role === "admin"
                  ? "Full admin access to the HomeReach platform."
                  : profile?.role === "nonprofit"
                  ? "Nonprofit account — eligible for subsidized campaigns."
                  : profile?.role === "sponsor"
                  ? "Sponsor account — manage your sponsorships."
                  : "Standard client account."}
              </p>
            </div>
          </div>
        </section>

        {/* Danger zone */}
        <section className="rounded-2xl border border-red-100 bg-white shadow-sm">
          <div className="border-b border-red-100 px-6 py-4">
            <h2 className="font-semibold text-red-700">Danger zone</h2>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-500">
              To permanently delete your account and all associated data, contact{" "}
              <a
                href="mailto:support@homereach.com"
                className="text-red-600 hover:underline"
              >
                support@homereach.com
              </a>
              . This action cannot be undone.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
