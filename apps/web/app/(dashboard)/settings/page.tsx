import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { db, profiles } from "@homereach/db";
import { eq } from "drizzle-orm";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings - HomeReach" };

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
    <div className="max-w-2xl space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          Account details
        </p>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-gray-500">
          Keep the contact details current so campaign updates, billing notes,
          and reply handoffs reach the right person.
        </p>
      </div>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-blue-600">
          Why this matters
        </p>
        <p className="mt-2 text-sm font-bold leading-6 text-blue-950">
          HomeReach uses these details to keep approvals, campaign updates, and
          customer response handoffs from getting stuck.
        </p>
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Profile</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              The name and phone number HomeReach should use for campaign
              support.
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

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Email address</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              Used for login, receipts, campaign updates, and important account
              notices.
            </p>
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="break-all text-sm font-medium text-gray-700">
                {user.email}
              </p>
              <span className="text-xs font-semibold text-gray-400">
                Login email
              </span>
            </div>
            <p className="mt-3 text-xs leading-5 text-gray-400">
              To change your email, contact{" "}
              <a
                href="mailto:support@homereach.com"
                className="font-semibold text-blue-600 hover:underline"
              >
                support@homereach.com
              </a>
              .
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Account type</h2>
            <p className="mt-0.5 text-sm text-gray-400">
              Controls the level of access and support connected to this
              account.
            </p>
          </div>
          <div className="p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <span className="inline-flex w-fit items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold capitalize text-blue-700">
                {profile?.role ?? "client"}
              </span>
              <p className="text-sm leading-6 text-gray-500">
                {profile?.role === "admin"
                  ? "Admin access for operating the HomeReach platform."
                  : profile?.role === "nonprofit"
                    ? "Nonprofit account with support for eligible campaigns."
                    : profile?.role === "sponsor"
                      ? "Sponsor account for connected sponsorship work."
                      : "Standard client account for HomeReach campaign services."}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-6 py-4">
            <h2 className="font-semibold text-gray-900">Account help</h2>
          </div>
          <div className="p-6">
            <p className="text-sm leading-6 text-gray-500">
              For account closure, data requests, or access changes, contact{" "}
              <a
                href="mailto:support@homereach.com"
                className="font-semibold text-blue-600 hover:underline"
              >
                support@homereach.com
              </a>
              . HomeReach will confirm the request before making account-level
              changes.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
