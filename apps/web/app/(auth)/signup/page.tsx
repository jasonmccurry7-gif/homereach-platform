import type { Metadata } from "next";
import { safeRelativeRedirect } from "@/lib/marketing/product-routes";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = {
  title: "Create Account",
};
export const dynamic = "force-dynamic";

interface SignupPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

export default async function SignupPage({ searchParams }: SignupPageProps) {
  const params = await searchParams;
  const redirect = safeRelativeRedirect(params.redirect);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-gray-900">HomeReach</h1>
          <p className="mt-2 text-gray-600">Create your account</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
          <SignupForm redirect={redirect} />
        </div>
      </div>
    </div>
  );
}
