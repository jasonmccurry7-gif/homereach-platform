import type { Metadata } from "next";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata: Metadata = { title: "Set New Password — HomeReach" };

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-black text-lg">
            HR
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white">Set new password</h1>
            <p className="mt-1 text-sm text-gray-400">
              Choose a strong password for your account
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 shadow-xl">
          <ResetPasswordForm />
        </div>
      </div>
    </div>
  );
}
