import type { Metadata } from "next";
import {
  DEFAULT_VERIFICATION_DESTINATION,
  getEmailInfrastructureAudit,
} from "@/lib/email-infrastructure/verification";
import { EmailInfrastructureClient } from "./email-infrastructure-client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Email Infrastructure - HomeReach Admin",
};

export default async function EmailInfrastructurePage() {
  const audit = await getEmailInfrastructureAudit();

  return (
    <div className="min-h-screen bg-slate-100 p-4 text-slate-950 md:p-6">
      <div className="mx-auto max-w-7xl">
        <EmailInfrastructureClient
          initialAudit={audit}
          defaultDestination={DEFAULT_VERIFICATION_DESTINATION}
        />
      </div>
    </div>
  );
}
