"use server";

// ─────────────────────────────────────────────────────────────────────────────
// Public /c/[token] server action — sign contract.
//
// No Supabase Auth on this path. The public_token IS the authentication.
// ─────────────────────────────────────────────────────────────────────────────

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isPoliticalEnabled } from "@/lib/political/env";
import { signContractByToken } from "@/lib/political/contracts";

function requireFlag(): void {
  if (!isPoliticalEnabled()) {
    throw new Error("Political Command Center is disabled.");
  }
}

/** Best-effort client IP extraction. Honors standard proxy headers. Falls
 *  back to null rather than guessing. */
async function resolveSignerIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? null;
}

export async function signContractAction(formData: FormData): Promise<void> {
  requireFlag();

  const token = String(formData.get("token") ?? "").trim();
  const signerName = String(formData.get("signer_name") ?? "").trim();
  const signerEmail = String(formData.get("signer_email") ?? "").trim();
  const consent = formData.get("consent") === "on";

  if (!token) redirect("/");
  if (!consent) {
    redirect(`/c/${token}?error=consent_required`);
  }
  if (!signerName || !signerEmail) {
    redirect(`/c/${token}?error=missing_fields`);
  }

  const signerIp = await resolveSignerIp();

  try {
    await signContractByToken({ token, signerName, signerEmail, signerIp });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown_error";
    redirect(`/c/${token}?error=${encodeURIComponent(msg)}`);
  }

  redirect(`/c/${token}?signed=1`);
}
